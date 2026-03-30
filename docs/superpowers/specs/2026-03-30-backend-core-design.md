# CCC2 Backend Core — Design Spec

## Overview

Replace mock data with real tmux-backed sessions and xterm.js terminal rendering. Each session is a separate tmux session (`ccc-{name}`). Electron main process manages PTY lifecycle. Renderer connects xterm.js to PTY via IPC. Performance goal: zero perceptible latency — every session must feel identical to working in a native terminal.

## Non-Negotiable Constraint

**Terminal performance.** Input-to-screen latency must match a native terminal. No buffering, no serialization, no processing on the hot path. Raw bytes from keyboard → PTY → tmux → claude and back. Everything else (state detection, UI updates) happens asynchronously on side channels.

## Architecture

### Session Lifecycle

Each session maps to a tmux session named `ccc-{name}`:

```
Create  → tmux new-session -d -s ccc-{name} -c {dir} -- claude
Attach  → node-pty spawns: tmux attach -t ccc-{name}
          PTY output streams via IPC to xterm.js in renderer
Detach  → PTY process killed (tmux session continues running)
Kill    → tmux kill-session -t ccc-{name}
List    → tmux list-sessions -F "#{session_name}..." filtered by ccc- prefix
```

Session attach/detach happens on view change:
- **Single mode**: One PTY active (the visible session)
- **Grid mode**: One PTY per visible panel
- **Session switch**: Detach old → attach new (must feel instant)

### Data Flow (Hot Path)

```
Keyboard input:
  xterm.js.onData → ipcRenderer.send('terminal:write', id, data)
  → main process: pty.write(data)
  → tmux → claude process

Terminal output:
  node-pty.onData → webContents.send('terminal:data', id, data)
  → renderer: xterm.js.write(data)
```

Both directions use fire-and-forget IPC (`send`, not `invoke`). No awaiting, no request/response, no intermediate processing. Raw bytes end to end.

## Components (Main Process)

### `src/main/pty-manager.ts`

Manages node-pty instances. One PTY per active attach (not per session).

```typescript
interface PtyManager {
  // Spawn tmux attach for a session, start streaming data
  attach(sessionId: string, sessionName: string): void

  // Kill PTY process (tmux session stays alive)
  detach(sessionId: string): void

  // Write input to PTY (hot path — no processing)
  write(sessionId: string, data: string): void

  // Resize PTY (triggers SIGWINCH → tmux → claude)
  resize(sessionId: string, cols: number, rows: number): void

  // Returns true if session has an active PTY
  isAttached(sessionId: string): boolean
}
```

Implementation details:
- Uses `node-pty.spawn('tmux', ['attach-session', '-t', sessionName])`
- Stores active PTYs in a `Map<sessionId, IPty>`
- `onData` callback sends raw data to renderer via `webContents.send`
- `onExit` callback cleans up map entry and notifies renderer
- **No buffering, no transformation** on data events
- electron-rebuild required for node-pty native addon

### `src/main/session-manager.ts`

CRUD for tmux sessions. Maintains in-memory session list synced with tmux.

```typescript
interface SessionManager {
  // List all ccc-* tmux sessions
  list(): Promise<Session[]>

  // Create tmux session, return Session object
  create(opts: SessionCreate): Promise<Session>

  // Kill tmux session
  kill(id: string): Promise<void>

  // Rename tmux session
  rename(id: string, newName: string): Promise<void>

  // Refresh session list from tmux (periodic sync)
  refresh(): Promise<void>
}
```

Implementation details:
- Runs `tmux list-sessions -F` to enumerate sessions
- Filters by `ccc-` prefix to avoid listing unrelated tmux sessions
- Parses: session name, creation time, attached status, current path
- Session creation runs: `tmux new-session -d -s ccc-{name} -c {dir} -e CCC_SESSION_NAME={name} -- claude`
- Shell-only sessions: `tmux new-session -d -s ccc-{name} -c {dir}` (no claude command)
- Detects git branch via `git -C {dir} rev-parse --abbrev-ref HEAD`
- Periodic refresh every 5 seconds to catch external changes (sessions killed outside CCC)
- Validates that `tmux` is in PATH on startup, shows error if not
- Validates that `claude` is in PATH when creating claude sessions, shows error if not

### `src/main/state-detector.ts`

Async session state detection. Never blocks terminal I/O.

```typescript
type SessionStatus = 'idle' | 'working' | 'waiting' | 'stopped' | 'error'

interface StateDetector {
  // Start watching for state changes
  start(): void

  // Stop watching
  stop(): void

  // Get current state for a session
  getState(sessionName: string): SessionStatus

  // Event: state changed
  onStateChanged: (sessionName: string, status: SessionStatus) => void
}
```

**Hook-based detection (primary):**
- Watches `~/.ccc/states/` directory with `fs.watch`
- Each file contains one word: `idle`, `working`, or `waiting`
- Written by Claude Code hooks (`~/.ccc/hooks/ccc-state.sh`)
- Latency: <50ms from hook trigger to UI update

**Content analysis (fallback):**
- Renderer periodically sends terminal content snapshot to main (every 2s)
- IPC channel: `terminal:content-snapshot` (sessionId, lastLine)
- Detector checks for `❯` prompt pattern (idle) or active output (working)
- Only active for sessions without a hook-state file
- Runs in `setTimeout` — never blocks event loop

**State transitions:**
- Session created → `working` (claude is starting)
- Hook writes `idle` → session waiting for user input
- Hook writes `working` → claude processing
- Hook writes `waiting` → claude needs permission/approval
- PTY exit event → `stopped`
- tmux session gone → `error`

### `src/main/ipc/session.ts`

IPC handlers for session operations.

```typescript
// Request/Response (ipcMain.handle)
'session:create'  (opts: SessionCreate) → Session
'session:list'    () → Session[]
'session:kill'    (id: string) → void
'session:rename'  (id: string, newName: string) → void

// Fire-and-forget (ipcMain.on)
'session:attach'  (id: string)
'session:detach'  (id: string)
```

### `src/main/ipc/terminal.ts`

IPC handlers for terminal I/O. Hot path — minimal overhead.

```typescript
// Renderer → Main (fire-and-forget)
'terminal:write'   (sessionId: string, data: string)
'terminal:resize'  (sessionId: string, cols: number, rows: number)

// Main → Renderer (fire-and-forget)
'terminal:data'    (sessionId: string, data: string)

// Renderer → Main (periodic, low priority)
'terminal:content-snapshot' (sessionId: string, lastLine: string)

// Main → Renderer (event)
'session:state-changed' (sessionId: string, status: SessionStatus)
```

## Components (Preload)

### `src/preload/index.ts`

Extend the existing CccAPI with session and terminal channels:

```typescript
interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  session: {
    list: () => Promise<Session[]>
    create: (opts: SessionCreate) => Promise<Session>
    kill: (id: string) => Promise<void>
    rename: (id: string, newName: string) => Promise<void>
    attach: (id: string) => void
    detach: (id: string) => void
  }
  terminal: {
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    onData: (callback: (sessionId: string, data: string) => void) => () => void
    sendContentSnapshot: (sessionId: string, lastLine: string) => void
  }
  state: {
    onStateChanged: (callback: (sessionId: string, status: string) => void) => () => void
  }
}
```

`terminal.onData` returns an unsubscribe function. Uses `ipcRenderer.on`/`ipcRenderer.removeListener`.

## Components (Renderer)

### `src/renderer/hooks/useTerminal.ts`

xterm.js lifecycle hook. Manages terminal instance, addons, and IPC binding.

```typescript
function useTerminal(
  containerRef: RefObject<HTMLDivElement>,
  sessionId: string | null
): void
```

Responsibilities:
- Creates xterm.js `Terminal` instance with WebGL renderer
- Attaches `FitAddon` and triggers fit on mount, resize, sidebar toggle, grid resize
- Binds `terminal.onData` → `cccAPI.terminal.write` (user input)
- Binds `cccAPI.terminal.onData` → `terminal.write` (PTY output)
- Calls `cccAPI.session.attach` on mount, `cccAPI.session.detach` on unmount
- Handles resize: `FitAddon.fit()` → `cccAPI.terminal.resize(cols, rows)`
- Disposes terminal on unmount
- Uses `ResizeObserver` on container for responsive fit

xterm.js config:
```typescript
{
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 13,
  theme: {
    background: 'var(--bg-terminal)' // resolved at runtime
  },
  scrollback: 10000,
  cursorBlink: true,
  cursorStyle: 'block',
  allowProposedApi: true // required for WebGL addon
}
```

Theme must be updated when user toggles light/dark mode.

### `src/renderer/components/TerminalPanel.tsx` (modified)

Replace mock terminal with real xterm.js:

- Container div with `ref` passed to `useTerminal`
- `sessionId` prop determines which session to attach
- `showHeader` prop for grid mode panel headers
- When `sessionId` changes: old terminal disposes, new one attaches (must be instant — tmux attach delivers scrollback buffer immediately)

### `src/renderer/components/GridView.tsx` (modified)

Each grid panel renders a real `TerminalPanel` with its own xterm.js instance:
- Panel becomes visible → `useTerminal` mounts → attach PTY
- Panel hidden → `useTerminal` unmounts → detach PTY
- Panel resized → `FitAddon.fit()` → `terminal:resize` → `pty.resize()` → SIGWINCH
- Active panel gets keyboard focus

### `src/renderer/stores/session-store.ts` (modified)

Replace mock data with real session management:
- `sessions` populated from `cccAPI.session.list()` on app start
- `createSession` calls `cccAPI.session.create()` instead of generating mock data
- `removeSession` calls `cccAPI.session.kill()`
- Add `refreshSessions()` action that polls `session:list` every 5s
- Add `sessionStatuses: Map<string, SessionStatus>` updated via `state:onStateChanged`
- Remove all mock data

### `src/renderer/components/NewSessionModal.tsx` (modified)

Replace mock form submission:
- `createSession` calls the real IPC `session.create`
- Add session type selector: Claude or Shell
- Add loading state while session is being created
- Working directory input: text input for now (file picker in Config & Settings sub-project)

### `src/renderer/components/SessionCard.tsx` (modified)

Add real status indicators based on `sessionStatuses`:
- `idle` → green dot (session ready for input)
- `working` → amber dot with pulse animation (claude processing)
- `waiting` → red dot with pulse (needs permission)
- `stopped` → grey dot
- `error` → red dot

## Dependencies

New npm packages:
- `node-pty` — Native PTY binding
- `@xterm/xterm` — Terminal emulator
- `@xterm/addon-webgl` — GPU-accelerated rendering
- `@xterm/addon-fit` — Auto-resize

Build requirements:
- `electron-rebuild -f -w node-pty` after npm install
- Add to package.json scripts: `"rebuild": "electron-rebuild -f -w node-pty"`
- `"postinstall": "electron-builder install-app-deps"` (already exists)

## File Map

```
src/
├── main/
│   ├── index.ts                 # Modified: init session-manager, state-detector
│   ├── pty-manager.ts           # New: node-pty lifecycle
│   ├── session-manager.ts       # New: tmux session CRUD
│   ├── state-detector.ts        # New: hook + content state detection
│   └── ipc/
│       ├── session.ts           # New: session IPC handlers
│       └── terminal.ts          # New: terminal I/O IPC handlers
├── preload/
│   └── index.ts                 # Modified: add session/terminal/state API
├── renderer/
│   ├── hooks/
│   │   ├── useTerminal.ts       # New: xterm.js lifecycle
│   │   └── useKeyboard.ts       # Existing, no changes
│   ├── components/
│   │   ├── TerminalPanel.tsx    # Modified: real xterm.js instead of mock
│   │   ├── GridView.tsx         # Modified: real terminals per panel
│   │   ├── NewSessionModal.tsx  # Modified: real session creation + type selector
│   │   ├── SessionCard.tsx      # Modified: real status indicators
│   │   └── ...                  # Others unchanged
│   ├── stores/
│   │   └── session-store.ts     # Modified: real IPC calls, remove mock data
│   └── styles/
│       └── index.css            # Modified: xterm.js container styles, status pulse animation
└── shared/
    └── types.ts                 # Modified: add SessionStatus, update Session type
```

## Updated Data Model

```typescript
// shared/types.ts additions

export type SessionStatus = 'idle' | 'working' | 'waiting' | 'stopped' | 'error'

export type SessionType = 'claude' | 'shell'

export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: SessionStatus           // was: 'running' | 'stopped' | 'error'
  type: SessionType               // new
  gitBranch?: string              // new
  createdAt: number
  lastActiveAt: number
}

export interface SessionCreate {
  name: string
  workingDirectory: string
  type: SessionType               // new
}
```

## Error Handling

- **tmux not installed**: Show persistent banner in UI: "tmux is required. Install with: sudo apt install tmux"
- **claude not in PATH**: Show error when creating claude session: "Claude Code CLI not found in PATH"
- **PTY crash**: Catch `onExit`, mark session as `error`, offer restart
- **tmux session vanishes**: Periodic refresh detects it, mark as `error`, remove from list
- **SSH hang on remote attach** (future): Not in scope for this sub-project

## What's NOT in Scope

- Config persistence (`~/.ccc/config.json`) — Sub-project 2
- Favorite repos / directory picker — Sub-project 2
- Settings UI — Sub-project 2
- Remote sessions (SSH) — Sub-project 3
- Git worktrees, groups, diff, PR review — Sub-project 4
- Hook installation flow — Sub-project 2 (settings)
