# Backend Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock data with real tmux-backed sessions and xterm.js terminal rendering, with zero-lag input/output matching native terminal performance.

**Architecture:** Each session is a separate tmux session (`ccc-{name}`). Main process manages PTY lifecycle via node-pty. Renderer renders terminal output via xterm.js with WebGL. IPC uses fire-and-forget for terminal I/O hot path. Session state detection via file-watching hooks with content-analysis fallback.

**Tech Stack:** node-pty, @xterm/xterm, @xterm/addon-webgl, @xterm/addon-fit, electron-rebuild, tmux

---

## File Map

```
src/
├── main/
│   ├── index.ts                    # Modified: init managers, register IPC
│   ├── pty-manager.ts              # New: node-pty lifecycle (attach/detach/write/resize)
│   ├── session-manager.ts          # New: tmux session CRUD (create/list/kill)
│   ├── state-detector.ts           # New: hook file watcher + content fallback
│   └── ipc/
│       ├── session.ts              # New: session IPC handlers (handle + on)
│       └── terminal.ts             # New: terminal I/O IPC handlers (fire-and-forget)
├── preload/
│   └── index.ts                    # Modified: add session/terminal/state API
├── renderer/
│   ├── hooks/
│   │   └── useTerminal.ts          # New: xterm.js lifecycle hook
│   ├── components/
│   │   ├── TerminalPanel.tsx       # Modified: real xterm.js instead of mock
│   │   ├── GridView.tsx            # Modified: real terminals per panel
│   │   ├── NewSessionModal.tsx     # Modified: real IPC + session type selector
│   │   └── SessionCard.tsx         # Modified: real status colors + pulse
│   ├── stores/
│   │   └── session-store.ts        # Modified: real IPC, remove mock data
│   └── styles/
│       └── index.css               # Modified: xterm container + pulse animation
└── shared/
    └── types.ts                    # Modified: SessionStatus, SessionType, CccAPI
```

---

### Task 1: Install Dependencies and Configure Build

**Files:**
- Modify: `package.json`
- Modify: `electron.vite.config.ts`

- [ ] **Step 1: Install node-pty and xterm packages**

```bash
cd /home/adam/Documents/Dev/code-command-center2
npm install node-pty @xterm/xterm @xterm/addon-webgl @xterm/addon-fit
```

- [ ] **Step 2: Add rebuild script to package.json**

In `package.json`, add to `"scripts"`:

```json
"rebuild": "electron-rebuild -f -w node-pty"
```

And install electron-rebuild as dev dep:

```bash
npm install -D electron-rebuild
```

- [ ] **Step 3: Run electron-rebuild for node-pty**

```bash
npm run rebuild
```

Expected: node-pty native addon compiled successfully for Electron's Node version.

- [ ] **Step 4: Add node-pty to externalizeDeps**

In `electron.vite.config.ts`, ensure node-pty is externalized in the main process config. The `externalizeDepsPlugin()` should handle this automatically, but verify by running:

```bash
npx electron-vite build
```

Expected: Build succeeds with no errors about node-pty resolution.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts
git commit -m "Add node-pty, xterm.js dependencies and electron-rebuild"
```

---

### Task 2: Update Shared Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Update types**

Replace `src/shared/types.ts` with:

```typescript
export type SessionStatus = 'idle' | 'working' | 'waiting' | 'stopped' | 'error'

export type SessionType = 'claude' | 'shell'

export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: SessionStatus
  type: SessionType
  gitBranch?: string
  createdAt: number
  lastActiveAt: number
}

export interface SessionCreate {
  name: string
  workingDirectory: string
  type: SessionType
}

export type ViewMode = 'single' | 'grid'

export type Theme = 'dark' | 'light'

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  session: {
    list: () => Promise<Session[]>
    create: (opts: SessionCreate) => Promise<Session>
    kill: (id: string) => Promise<void>
    attach: (id: string) => void
    detach: (id: string) => void
  }
  terminal: {
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    onData: (callback: (sessionId: string, data: string) => void) => () => void
  }
  state: {
    onStateChanged: (callback: (sessionId: string, status: SessionStatus) => void) => () => void
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "Update shared types with SessionStatus, SessionType, and full CccAPI"
```

---

### Task 3: Session Manager (Main Process)

**Files:**
- Create: `src/main/session-manager.ts`

- [ ] **Step 1: Create session manager**

Write `src/main/session-manager.ts`:

```typescript
import { execSync, execFileSync } from 'child_process'
import type { Session, SessionCreate } from '../shared/types'

function tmux(...args: string[]): string | null {
  try {
    return execFileSync('tmux', args, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

function isTmuxInstalled(): boolean {
  try {
    execFileSync('which', ['tmux'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

function isClaudeInstalled(): boolean {
  try {
    execFileSync('which', ['claude'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

function getGitBranch(dir: string): string | undefined {
  try {
    const expanded = dir.replace(/^~/, process.env.HOME ?? '')
    return execFileSync('git', ['-C', expanded, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf-8',
      timeout: 3000
    }).trim() || undefined
  } catch {
    return undefined
  }
}

function generateId(): string {
  return `ccc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const PREFIX = 'ccc-'

export class SessionManager {
  private sessions: Map<string, Session> = new Map()

  checkDependencies(): { tmux: boolean; claude: boolean } {
    return { tmux: isTmuxInstalled(), claude: isClaudeInstalled() }
  }

  async list(): Promise<Session[]> {
    const output = tmux(
      'list-sessions', '-F',
      '#{session_name}\t#{session_created}\t#{pane_current_path}'
    )
    if (!output) return Array.from(this.sessions.values())

    const tmuxSessions = new Set<string>()

    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath] = line.split('\t')
      if (!name?.startsWith(PREFIX)) continue

      tmuxSessions.add(name)
      const existing = this.findByTmuxName(name)

      if (existing) {
        existing.workingDirectory = currentPath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        existing.gitBranch = getGitBranch(existing.workingDirectory)
        if (existing.status === 'error') existing.status = 'idle'
      } else {
        const created = createdStr ? parseInt(createdStr) * 1000 : Date.now()
        const session: Session = {
          id: generateId(),
          name: name.slice(PREFIX.length),
          workingDirectory: currentPath || '~',
          status: 'idle',
          type: 'claude',
          gitBranch: getGitBranch(currentPath || '~'),
          createdAt: created,
          lastActiveAt: Date.now()
        }
        this.sessions.set(session.id, session)
      }
    }

    // Mark sessions whose tmux session is gone
    for (const session of this.sessions.values()) {
      const tmuxName = PREFIX + session.name
      if (!tmuxSessions.has(tmuxName) && session.status !== 'stopped') {
        session.status = 'stopped'
      }
    }

    return Array.from(this.sessions.values())
      .filter(s => s.status !== 'stopped')
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async create(opts: SessionCreate): Promise<Session> {
    const tmuxName = PREFIX + opts.name
    const expandedDir = opts.workingDirectory.replace(/^~/, process.env.HOME ?? '')

    const args = ['new-session', '-d', '-s', tmuxName, '-c', expandedDir,
      '-e', `CCC_SESSION_NAME=${opts.name}`]

    if (opts.type === 'claude') {
      args.push('--', 'claude')
    }

    const result = tmux(...args)
    if (result === null) {
      // Check if it failed — tmux returns empty on success
      const check = tmux('has-session', '-t', `=${tmuxName}`)
      if (check === null) {
        throw new Error(`Failed to create tmux session: ${tmuxName}`)
      }
    }

    const session: Session = {
      id: generateId(),
      name: opts.name,
      workingDirectory: opts.workingDirectory,
      status: opts.type === 'claude' ? 'working' : 'idle',
      type: opts.type,
      gitBranch: getGitBranch(expandedDir),
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }

    this.sessions.set(session.id, session)
    return session
  }

  async kill(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return

    const tmuxName = PREFIX + session.name
    tmux('kill-session', '-t', `=${tmuxName}`)
    session.status = 'stopped'
    this.sessions.delete(id)
  }

  getById(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getTmuxName(id: string): string | undefined {
    const session = this.sessions.get(id)
    return session ? PREFIX + session.name : undefined
  }

  updateStatus(sessionName: string, status: Session['status']): void {
    for (const session of this.sessions.values()) {
      if (session.name === sessionName) {
        session.status = status
        break
      }
    }
  }

  private findByTmuxName(tmuxName: string): Session | undefined {
    const name = tmuxName.slice(PREFIX.length)
    for (const session of this.sessions.values()) {
      if (session.name === name) return session
    }
    return undefined
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx electron-vite build 2>&1 | head -10
```

Expected: main process builds without errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "Add SessionManager for tmux session CRUD"
```

---

### Task 4: PTY Manager (Main Process)

**Files:**
- Create: `src/main/pty-manager.ts`

- [ ] **Step 1: Create PTY manager**

Write `src/main/pty-manager.ts`:

```typescript
import * as pty from 'node-pty'
import type { BrowserWindow } from 'electron'

interface ActivePty {
  pty: pty.IPty
  sessionId: string
}

export class PtyManager {
  private ptys: Map<string, ActivePty> = new Map()
  private window: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  attach(sessionId: string, tmuxSessionName: string): void {
    // Detach existing if any
    this.detach(sessionId)

    const shell = process.env.SHELL || '/bin/bash'

    const ptyProcess = pty.spawn(shell, ['-lc', `tmux attach-session -t '=${tmuxSessionName}'`], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' }
    })

    ptyProcess.onData((data) => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('terminal:data', sessionId, data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.ptys.delete(sessionId)
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('terminal:exit', sessionId, exitCode)
      }
    })

    this.ptys.set(sessionId, { pty: ptyProcess, sessionId })
  }

  detach(sessionId: string): void {
    const active = this.ptys.get(sessionId)
    if (!active) return
    try {
      active.pty.kill()
    } catch {
      // Process may already be dead
    }
    this.ptys.delete(sessionId)
  }

  write(sessionId: string, data: string): void {
    const active = this.ptys.get(sessionId)
    if (active) {
      active.pty.write(data)
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const active = this.ptys.get(sessionId)
    if (active) {
      active.pty.resize(cols, rows)
    }
  }

  isAttached(sessionId: string): boolean {
    return this.ptys.has(sessionId)
  }

  detachAll(): void {
    for (const [id] of this.ptys) {
      this.detach(id)
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx electron-vite build 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/main/pty-manager.ts
git commit -m "Add PtyManager for node-pty lifecycle"
```

---

### Task 5: State Detector (Main Process)

**Files:**
- Create: `src/main/state-detector.ts`

- [ ] **Step 1: Create state detector**

Write `src/main/state-detector.ts`:

```typescript
import { watch, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { SessionStatus } from '../shared/types'
import type { BrowserWindow } from 'electron'

const STATES_DIR = join(process.env.HOME ?? '', '.ccc', 'states')

const VALID_STATES: Record<string, SessionStatus> = {
  idle: 'idle',
  working: 'working',
  waiting: 'waiting'
}

export class StateDetector {
  private window: BrowserWindow | null = null
  private watcher: ReturnType<typeof watch> | null = null
  private states: Map<string, SessionStatus> = new Map()

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  start(): void {
    if (!existsSync(STATES_DIR)) {
      mkdirSync(STATES_DIR, { recursive: true })
    }

    // Read initial states
    this.scanAll()

    // Watch for changes
    try {
      this.watcher = watch(STATES_DIR, (eventType, filename) => {
        if (!filename) return
        this.readState(filename)
      })
    } catch {
      // fs.watch may fail on some systems — fallback to polling
      setInterval(() => this.scanAll(), 2000)
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  getState(sessionName: string): SessionStatus {
    return this.states.get(sessionName) ?? 'idle'
  }

  // Called from renderer with terminal content for fallback detection
  analyzeContent(sessionName: string, lastLine: string): void {
    // Only use content analysis if no hook state exists
    if (this.states.has(sessionName)) return

    let detected: SessionStatus = 'working'
    const trimmed = lastLine.trim()

    if (trimmed.endsWith('❯') || trimmed.endsWith('$') || trimmed.endsWith('%')) {
      detected = 'idle'
    }

    const current = this.states.get(sessionName)
    if (current !== detected) {
      this.states.set(sessionName, detected)
      this.emit(sessionName, detected)
    }
  }

  private scanAll(): void {
    try {
      const { readdirSync } = require('fs')
      const files = readdirSync(STATES_DIR) as string[]
      for (const file of files) {
        this.readState(file)
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private readState(filename: string): void {
    const filepath = join(STATES_DIR, filename)
    try {
      const content = readFileSync(filepath, 'utf-8').trim()
      const status = VALID_STATES[content]
      if (!status) return

      const prev = this.states.get(filename)
      this.states.set(filename, status)

      if (prev !== status) {
        this.emit(filename, status)
      }
    } catch {
      // File may have been deleted
    }
  }

  private emit(sessionName: string, status: SessionStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('session:state-changed', sessionName, status)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/state-detector.ts
git commit -m "Add StateDetector with hook file watcher and content analysis fallback"
```

---

### Task 6: IPC Handlers (Main Process)

**Files:**
- Create: `src/main/ipc/session.ts`
- Create: `src/main/ipc/terminal.ts`

- [ ] **Step 1: Create session IPC handlers**

Create directory and write `src/main/ipc/session.ts`:

```typescript
import { ipcMain } from 'electron'
import type { SessionManager } from '../session-manager'
import type { SessionCreate } from '../../shared/types'

export function registerSessionIpc(sessionManager: SessionManager): void {
  ipcMain.handle('session:list', async () => {
    return sessionManager.list()
  })

  ipcMain.handle('session:create', async (_event, opts: SessionCreate) => {
    return sessionManager.create(opts)
  })

  ipcMain.handle('session:kill', async (_event, id: string) => {
    return sessionManager.kill(id)
  })
}
```

- [ ] **Step 2: Create terminal IPC handlers**

Write `src/main/ipc/terminal.ts`:

```typescript
import { ipcMain } from 'electron'
import type { PtyManager } from '../pty-manager'
import type { SessionManager } from '../session-manager'
import type { StateDetector } from '../state-detector'

export function registerTerminalIpc(
  ptyManager: PtyManager,
  sessionManager: SessionManager,
  stateDetector: StateDetector
): void {
  // Fire-and-forget: attach PTY for a session
  ipcMain.on('session:attach', (_event, id: string) => {
    const tmuxName = sessionManager.getTmuxName(id)
    if (tmuxName) {
      ptyManager.attach(id, tmuxName)
    }
  })

  // Fire-and-forget: detach PTY
  ipcMain.on('session:detach', (_event, id: string) => {
    ptyManager.detach(id)
  })

  // Fire-and-forget: write to PTY (HOT PATH — no processing)
  ipcMain.on('terminal:write', (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data)
  })

  // Fire-and-forget: resize PTY
  ipcMain.on('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows)
  })

  // Low priority: content snapshot for fallback state detection
  ipcMain.on('terminal:content-snapshot', (_event, sessionName: string, lastLine: string) => {
    stateDetector.analyzeContent(sessionName, lastLine)
  })
}
```

- [ ] **Step 3: Commit**

```bash
mkdir -p src/main/ipc
git add src/main/ipc/session.ts src/main/ipc/terminal.ts
git commit -m "Add session and terminal IPC handlers"
```

---

### Task 7: Wire Up Main Process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Update main process to init managers and register IPC**

Replace `src/main/index.ts` with:

```typescript
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { PtyManager } from './pty-manager'
import { StateDetector } from './state-detector'
import { registerSessionIpc } from './ipc/session'
import { registerTerminalIpc } from './ipc/terminal'

const sessionManager = new SessionManager()
const ptyManager = new PtyManager()
const stateDetector = new StateDetector()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  ptyManager.setWindow(mainWindow)
  stateDetector.setWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    ptyManager.detachAll()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Window controls IPC
ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close())

// Register session and terminal IPC
registerSessionIpc(sessionManager)
registerTerminalIpc(ptyManager, sessionManager, stateDetector)

// Start state detector
stateDetector.start()

app.whenReady().then(() => {
  // Check dependencies
  const deps = sessionManager.checkDependencies()
  if (!deps.tmux) {
    console.error('tmux is not installed. Install with: sudo apt install tmux')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stateDetector.stop()
  ptyManager.detachAll()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 2: Verify build**

```bash
npx electron-vite build
```

Expected: All three targets (main, preload, renderer) build successfully.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "Wire up session manager, PTY manager, and state detector in main process"
```

---

### Task 8: Update Preload Script

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Extend preload with session, terminal, and state APIs**

Replace `src/preload/index.ts` with:

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { CccAPI, SessionCreate, SessionStatus } from '../shared/types'

const api: CccAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    create: (opts: SessionCreate) => ipcRenderer.invoke('session:create', opts),
    kill: (id: string) => ipcRenderer.invoke('session:kill', id),
    attach: (id: string) => ipcRenderer.send('session:attach', id),
    detach: (id: string) => ipcRenderer.send('session:detach', id)
  },
  terminal: {
    write: (sessionId: string, data: string) => ipcRenderer.send('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string): void => {
        callback(sessionId, data)
      }
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    }
  },
  state: {
    onStateChanged: (callback: (sessionId: string, status: SessionStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, status: SessionStatus): void => {
        callback(sessionId, status)
      }
      ipcRenderer.on('session:state-changed', handler)
      return () => ipcRenderer.removeListener('session:state-changed', handler)
    }
  }
}

contextBridge.exposeInMainWorld('cccAPI', api)
```

- [ ] **Step 2: Update env.d.ts**

Read the existing `src/renderer/env.d.ts` and ensure it imports the updated CccAPI. It should already work since it imports from `../shared/types`.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "Extend preload with session, terminal, and state IPC APIs"
```

---

### Task 9: useTerminal Hook

**Files:**
- Create: `src/renderer/hooks/useTerminal.ts`

- [ ] **Step 1: Create the xterm.js lifecycle hook**

Write `src/renderer/hooks/useTerminal.ts`:

```typescript
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../stores/session-store'

function getTerminalTheme(theme: 'dark' | 'light'): Record<string, string> {
  if (theme === 'light') {
    return {
      background: '#fafafa',
      foreground: '#1a1a1a',
      cursor: '#d97706',
      selectionBackground: 'rgba(217, 119, 6, 0.2)',
      black: '#1a1a1a',
      brightBlack: '#555555'
    }
  }
  return {
    background: '#0d0d14',
    foreground: '#cccccc',
    cursor: '#f59e0b',
    selectionBackground: 'rgba(245, 158, 11, 0.2)',
    black: '#0a0a0f',
    brightBlack: '#555555'
  }
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  sessionId: string | null
): void {
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const unsubDataRef = useRef<(() => void) | null>(null)
  const theme = useSessionStore((s) => s.theme)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sessionId) return

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      theme: getTerminalTheme(theme)
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)

    // Load WebGL addon after open
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL not available — falls back to canvas renderer
    }

    fitAddon.fit()
    termRef.current = terminal
    fitRef.current = fitAddon

    // Send initial size
    const { cols, rows } = terminal
    window.cccAPI.terminal.resize(sessionId, cols, rows)

    // Attach to tmux session
    window.cccAPI.session.attach(sessionId)

    // User input → PTY
    const inputDisposable = terminal.onData((data) => {
      window.cccAPI.terminal.write(sessionId, data)
    })

    // PTY output → terminal
    const unsubData = window.cccAPI.terminal.onData((id, data) => {
      if (id === sessionId) {
        terminal.write(data)
      }
    })
    unsubDataRef.current = unsubData

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = terminal
      window.cccAPI.terminal.resize(sessionId, cols, rows)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      inputDisposable.dispose()
      if (unsubDataRef.current) unsubDataRef.current()
      window.cccAPI.session.detach(sessionId)
      terminal.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId, containerRef])

  // Update theme on change
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getTerminalTheme(theme)
    }
  }, [theme])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/useTerminal.ts
git commit -m "Add useTerminal hook with xterm.js WebGL, fit, and IPC binding"
```

---

### Task 10: Replace Mock TerminalPanel with Real xterm.js

**Files:**
- Modify: `src/renderer/components/TerminalPanel.tsx`
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Rewrite TerminalPanel**

Replace `src/renderer/components/TerminalPanel.tsx` with:

```tsx
import { useRef } from 'react'
import type { Session } from '../../shared/types'
import { useTerminal } from '../hooks/useTerminal'

interface TerminalPanelProps {
  session: Session
  showHeader?: boolean
}

const statusColors: Record<string, string> = {
  idle: 'var(--success)',
  working: 'var(--accent)',
  waiting: 'var(--error)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

export default function TerminalPanel({ session, showHeader = false }: TerminalPanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef, session.id)

  return (
    <div
      className="flex flex-col h-full rounded-md overflow-hidden"
      style={{ backgroundColor: 'var(--bg-terminal)' }}
    >
      {showHeader && (
        <div
          className="h-7 flex items-center px-3 text-[10px] font-semibold border-b flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--bg-raised)',
            color: 'var(--text-secondary)'
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full mr-2"
            style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
          />
          {session.name}
          {session.gitBranch && (
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
              {session.gitBranch}
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} className="flex-1 xterm-container" />
    </div>
  )
}
```

- [ ] **Step 2: Add xterm container styles**

Add to the end of `src/renderer/styles/index.css`:

```css
/* xterm.js container */
.xterm-container {
  width: 100%;
  height: 100%;
}

.xterm-container .xterm {
  height: 100%;
  padding: 4px;
}

/* Status pulse animation */
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-pulse {
  animation: status-pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/TerminalPanel.tsx src/renderer/styles/index.css
git commit -m "Replace mock TerminalPanel with real xterm.js rendering"
```

---

### Task 11: Update SessionCard with Real Status

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`

- [ ] **Step 1: Update SessionCard status colors and add pulse**

Replace `src/renderer/components/SessionCard.tsx` with:

```tsx
import type { Session } from '../../shared/types'

interface SessionCardProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const statusColors: Record<string, string> = {
  idle: 'var(--success)',
  working: 'var(--accent)',
  waiting: 'var(--error)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

const pulseStatuses = new Set(['working', 'waiting'])

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-100 border-l-2 group hover:bg-[rgba(255,255,255,0.03)]"
      style={{
        backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
        borderLeftColor: isActive ? 'var(--accent)' : 'transparent'
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulseStatuses.has(session.status) ? 'status-pulse' : ''}`}
          style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
        />
        <span
          className="text-xs font-medium truncate"
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {session.name}
        </span>
        {session.type === 'shell' && (
          <span className="text-[9px] px-1 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
            sh
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] mt-0.5 ml-3.5" style={{ color: 'var(--text-muted)' }}>
          {formatRelativeTime(session.lastActiveAt)}
        </span>
        {session.gitBranch && (
          <span className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {session.gitBranch}
          </span>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SessionCard.tsx
git commit -m "Update SessionCard with real status colors, pulse animation, and git branch"
```

---

### Task 12: Update Session Store — Remove Mock Data

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Replace mock store with real IPC-backed store**

Replace `src/renderer/stores/session-store.ts` with:

```typescript
import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, GridItem, Theme, SessionStatus } from '../../shared/types'

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  viewMode: ViewMode
  sidebarOpen: boolean
  sidebarWidth: number
  gridLayout: GridItem[]
  modalOpen: boolean
  theme: Theme
  loading: boolean

  loadSessions: () => Promise<void>
  createSession: (opts: SessionCreate) => Promise<void>
  removeSession: (id: string) => Promise<void>
  setActiveSession: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleModal: () => void
  toggleTheme: () => void
  updateGridLayout: (layout: GridItem[]) => void
  updateSessionStatus: (sessionName: string, status: SessionStatus) => void
  nextSession: () => void
  prevSession: () => void
}

function generateGridLayout(sessions: Session[]): GridItem[] {
  const cols = sessions.length <= 2 ? (sessions.length || 1) : sessions.length <= 4 ? 2 : 3
  return sessions.map((s, i) => ({
    i: s.id,
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1
  }))
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  viewMode: 'single',
  sidebarOpen: true,
  sidebarWidth: 260,
  gridLayout: [],
  modalOpen: false,
  theme: 'dark',
  loading: true,

  loadSessions: async () => {
    const sessions = await window.cccAPI.session.list()
    set((state) => ({
      sessions,
      loading: false,
      activeSessionId: state.activeSessionId && sessions.find(s => s.id === state.activeSessionId)
        ? state.activeSessionId
        : sessions[0]?.id ?? null,
      gridLayout: generateGridLayout(sessions)
    }))
  },

  createSession: async (opts) => {
    const session = await window.cccAPI.session.create(opts)
    set((state) => {
      const sessions = [...state.sessions, session]
      return {
        sessions,
        activeSessionId: session.id,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  removeSession: async (id) => {
    await window.cccAPI.session.kill(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeSessionId =
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId
      return {
        sessions,
        activeSessionId,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  setActiveSession: (id) => set({ activeSessionId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),
  toggleModal: () => set((state) => ({ modalOpen: !state.modalOpen })),
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    return { theme: next }
  }),
  updateGridLayout: (layout) => set({ gridLayout: layout }),

  updateSessionStatus: (sessionName, status) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.name === sessionName ? { ...s, status } : s
      )
    }))
  },

  nextSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const next = (idx + 1) % sessions.length
    set({ activeSessionId: sessions[next].id })
  },

  prevSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const prev = (idx - 1 + sessions.length) % sessions.length
    set({ activeSessionId: sessions[prev].id })
  }
}))
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "Replace mock session store with real IPC-backed store"
```

---

### Task 13: Update App.tsx — Init Store and State Listener

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add session loading and state change listener**

Replace `src/renderer/App.tsx` with:

```tsx
import { useEffect } from 'react'
import Layout from './components/Layout'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  useKeyboard()

  const loadSessions = useSessionStore((s) => s.loadSessions)
  const updateSessionStatus = useSessionStore((s) => s.updateSessionStatus)

  useEffect(() => {
    // Load sessions on startup
    loadSessions()

    // Refresh session list every 5 seconds
    const interval = setInterval(loadSessions, 5000)

    // Listen for state changes from hook detector
    const unsubState = window.cccAPI.state.onStateChanged((sessionName, status) => {
      updateSessionStatus(sessionName, status)
    })

    return () => {
      clearInterval(interval)
      unsubState()
    }
  }, [loadSessions, updateSessionStatus])

  return <Layout />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "Add session loading, periodic refresh, and state change listener to App"
```

---

### Task 14: Update NewSessionModal with Session Type

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add session type selector and async creation**

Replace `src/renderer/components/NewSessionModal.tsx` with:

```tsx
import { useState } from 'react'
import { X, Terminal, Bot } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { SessionType } from '../../shared/types'

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')
  const [type, setType] = useState<SessionType>('claude')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!modalOpen) return <></>

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !workingDirectory.trim() || creating) return

    setCreating(true)
    setError(null)

    try {
      await createSession({
        name: name.trim(),
        workingDirectory: workingDirectory.trim(),
        type
      })
      setName('')
      setWorkingDirectory('')
      setType('claude')
      toggleModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && !creating) toggleModal()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[420px] rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            New Session
          </h2>
          <button
            onClick={toggleModal}
            className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Session Type */}
          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('claude')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                style={{
                  backgroundColor: type === 'claude' ? 'var(--accent-muted)' : 'transparent',
                  borderColor: type === 'claude' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: type === 'claude' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                <Bot size={14} />
                Claude
              </button>
              <button
                type="button"
                onClick={() => setType('shell')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                style={{
                  backgroundColor: type === 'shell' ? 'var(--accent-muted)' : 'transparent',
                  borderColor: type === 'shell' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: type === 'shell' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                <Terminal size={14} />
                Shell
              </button>
            </div>
          </div>

          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api-server"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Working Directory
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="e.g. ~/projects/my-app"
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {error && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{error}</p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={toggleModal}
              disabled={creating}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--bg-raised)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)',
                opacity: creating ? 0.6 : 1
              }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx
git commit -m "Update NewSessionModal with session type selector and async creation"
```

---

### Task 15: Update GridView for Real Terminals

**Files:**
- Modify: `src/renderer/components/GridView.tsx`

- [ ] **Step 1: Update GridView to pass session to TerminalPanel properly**

The current `GridView.tsx` already renders `<TerminalPanel session={session} />` for each grid cell. The TerminalPanel now uses `useTerminal` which handles attach/detach on mount/unmount. The only change needed is to ensure each panel has `showHeader={true}` since grid panels need headers:

In `src/renderer/components/GridView.tsx`, change line 113:

```tsx
              <TerminalPanel session={session} />
```

To:

```tsx
              <TerminalPanel session={session} showHeader />
```

- [ ] **Step 2: Verify build**

```bash
npx electron-vite build
```

Expected: All targets build successfully.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/GridView.tsx
git commit -m "Enable showHeader on grid panels for session identification"
```

---

### Task 16: Update useKeyboard for Async removeSession

**Files:**
- Modify: `src/renderer/hooks/useKeyboard.ts`

- [ ] **Step 1: Update Ctrl+W handler for async removeSession**

In `src/renderer/hooks/useKeyboard.ts`, the `removeSession` call is now async. Update the Ctrl+W handler:

Change:

```typescript
      if (mod && e.key === 'w') {
        e.preventDefault()
        const { activeSessionId, removeSession } = useSessionStore.getState()
        if (activeSessionId) removeSession(activeSessionId)
        return
      }
```

To:

```typescript
      if (mod && e.key === 'w') {
        e.preventDefault()
        const { activeSessionId, removeSession } = useSessionStore.getState()
        if (activeSessionId) void removeSession(activeSessionId)
        return
      }
```

(Adding `void` to explicitly discard the promise — the store handles the state update.)

- [ ] **Step 2: Commit**

```bash
git add src/renderer/hooks/useKeyboard.ts
git commit -m "Handle async removeSession in keyboard shortcut"
```

---

### Task 17: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Verify tmux is installed**

```bash
tmux -V
```

Expected: `tmux X.Y` (any version)

- [ ] **Step 2: Build and run the app**

```bash
cd /home/adam/Documents/Dev/code-command-center2
npx electron-vite build && npm run dev
```

- [ ] **Step 3: Test session creation**

1. Click "+" or press Ctrl+N
2. Select "Claude" type
3. Enter name: "test-session"
4. Enter directory: "~"
5. Click Create
6. Expected: Session appears in sidebar, terminal shows Claude Code starting (or shell prompt)

- [ ] **Step 4: Test terminal I/O**

1. Type in the terminal
2. Expected: Input appears immediately (no lag)
3. If claude session: Claude Code should respond

- [ ] **Step 5: Test session switching**

1. Create a second session
2. Click between sessions in sidebar
3. Expected: Terminal switches instantly with tmux scrollback history

- [ ] **Step 6: Test grid mode**

1. Press Ctrl+G
2. Expected: All sessions visible in grid, each with its own terminal
3. Resize panels — terminals refit
4. Double-click a panel — returns to single mode

- [ ] **Step 7: Test session kill**

1. Press Ctrl+W
2. Expected: Session removed from sidebar, tmux session killed

- [ ] **Step 8: Verify tmux sessions exist**

```bash
tmux list-sessions | grep ccc-
```

Expected: Only running sessions listed. Killed sessions should not appear.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "Backend core integration complete: real tmux sessions with xterm.js rendering"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Dependencies + build config | package.json |
| 2 | Updated shared types | types.ts |
| 3 | Session manager (tmux CRUD) | session-manager.ts |
| 4 | PTY manager (node-pty) | pty-manager.ts |
| 5 | State detector (hooks + fallback) | state-detector.ts |
| 6 | IPC handlers | ipc/session.ts, ipc/terminal.ts |
| 7 | Wire up main process | index.ts |
| 8 | Preload API extension | preload/index.ts |
| 9 | useTerminal hook | useTerminal.ts |
| 10 | Real TerminalPanel | TerminalPanel.tsx |
| 11 | Real SessionCard status | SessionCard.tsx |
| 12 | Real session store | session-store.ts |
| 13 | App init + state listener | App.tsx |
| 14 | Modal with type selector | NewSessionModal.tsx |
| 15 | Grid with real terminals | GridView.tsx |
| 16 | Async keyboard handler | useKeyboard.ts |
| 17 | End-to-end verification | (testing) |
