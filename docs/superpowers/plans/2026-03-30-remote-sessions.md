# Remote Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SSH-based remote session management — create, attach, list, and kill tmux sessions on remote machines, with ControlMaster connection pooling and online/offline detection.

**Architecture:** SshService handles SSH command execution with ControlMaster pooling. SessionManager delegates to SshService for remote hosts. PtyManager spawns `ssh -t host tmux attach` for remote sessions. UI groups sessions under machine headers with online/offline status.

**Tech Stack:** SSH (ControlMaster), node-pty, Electron IPC, React/Zustand

---

## File Map

```
src/
├── main/
│   ├── ssh-service.ts              # New: SSH exec + ControlMaster pooling + online check
│   ├── session-manager.ts          # Modified: remote tmux via SshService
│   ├── pty-manager.ts              # Modified: remote attach via SSH
│   ├── config-service.ts           # Modified: load/save remoteHosts
│   ├── ipc/
│   │   ├── session.ts              # Modified: pass remoteHost in create
│   │   └── host.ts                 # New: host status IPC
│   └── index.ts                    # Modified: init SshService, register host IPC, periodic check
├── preload/
│   └── index.ts                    # Modified: add host API
├── renderer/
│   ├── components/
│   │   ├── SessionSidebar.tsx      # Modified: machine headers with grouping
│   │   ├── SessionCard.tsx         # Modified: remote indicator
│   │   ├── NewSessionModal.tsx     # Modified: host selector + per-host favorites
│   │   ├── SettingsModal.tsx       # Modified: Remote Hosts tab
│   │   └── SessionTopBar.tsx       # Modified: show host name for remote
│   ├── stores/
│   │   └── session-store.ts        # Modified: hostStatuses, remoteHosts state
│   └── App.tsx                     # Modified: load host statuses, listen for changes
└── shared/
    └── types.ts                    # Modified: RemoteHost, Session.remoteHost, host API
```

---

### Task 1: Update Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add RemoteHost interface and extend Session/SessionCreate/CccConfig/CccAPI**

In `src/shared/types.ts`:

Add after `FavoriteFolder`:
```typescript
export interface RemoteHost {
  name: string
  host: string
  favoriteFolders: FavoriteFolder[]
}
```

Add `remoteHost?: string` to `Session` (after `color`):
```typescript
  remoteHost?: string
```

Add `remoteHost?: string` to `SessionCreate` (after `type`):
```typescript
  remoteHost?: string
```

Add `remoteHosts: RemoteHost[]` to `CccConfig` (after `enabledProviders`):
```typescript
  remoteHosts: RemoteHost[]
```

Add `host` to `CccAPI` (after `config`):
```typescript
  host: {
    statuses: () => Promise<Record<string, boolean>>
    onStatusChanged: (callback: (name: string, online: boolean) => void) => () => void
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "Add RemoteHost type, remoteHost to Session/SessionCreate, host API"
```

---

### Task 2: SshService

**Files:**
- Create: `src/main/ssh-service.ts`

- [ ] **Step 1: Create SshService**

Write `src/main/ssh-service.ts`:

```typescript
import { execFileSync, spawn } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { BrowserWindow } from 'electron'

const CCC_DIR = join(process.env.HOME ?? '', '.ccc')

function sshOptions(host: string): string[] {
  return [
    '-o', 'ControlMaster=auto',
    '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
    '-o', 'ControlPersist=300',
    '-o', 'ConnectTimeout=5',
    '-o', 'BatchMode=yes',
    host
  ]
}

export class SshService {
  private hostStatuses: Map<string, boolean> = new Map()
  private window: BrowserWindow | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  exec(host: string, command: string): string | null {
    try {
      if (!existsSync(CCC_DIR)) mkdirSync(CCC_DIR, { recursive: true })
      return execFileSync('ssh', [...sshOptions(host), command], {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
    } catch {
      return null
    }
  }

  isOnline(host: string): boolean {
    try {
      execFileSync('ssh', [
        '-o', 'ConnectTimeout=3',
        '-o', 'BatchMode=yes',
        '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
        '-o', 'ControlMaster=auto',
        host, 'true'
      ], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      return true
    } catch {
      return false
    }
  }

  getStatuses(): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const [name, online] of this.hostStatuses) {
      result[name] = online
    }
    return result
  }

  startMonitoring(hosts: Array<{ name: string; host: string }>): void {
    // Initial check
    for (const h of hosts) {
      const online = this.isOnline(h.host)
      this.hostStatuses.set(h.name, online)
    }
    this.emitAll()

    // Periodic: re-check offline hosts every 10s
    this.checkInterval = setInterval(() => {
      let changed = false
      for (const h of hosts) {
        const wasOnline = this.hostStatuses.get(h.name) ?? false
        const nowOnline = this.isOnline(h.host)
        if (wasOnline !== nowOnline) {
          this.hostStatuses.set(h.name, nowOnline)
          changed = true
        }
      }
      if (changed) this.emitAll()
    }, 10000)
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private emitAll(): void {
    if (this.window && !this.window.isDestroyed()) {
      for (const [name, online] of this.hostStatuses) {
        this.window.webContents.send('host:status-changed', name, online)
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ssh-service.ts
git commit -m "Add SshService with SSH exec, ControlMaster pooling, and host monitoring"
```

---

### Task 3: Update ConfigService for RemoteHosts

**Files:**
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Add remoteHosts to defaults and load/update**

In `src/main/config-service.ts`:

Add `remoteHosts: []` to `DEFAULT_CONFIG`.

In `load()`, add to the parsed config object:
```typescript
          remoteHosts: Array.isArray(parsed.remoteHosts) ? parsed.remoteHosts : []
```

In `update()`, add:
```typescript
    if (partial.remoteHosts !== undefined) this.config.remoteHosts = partial.remoteHosts
```

- [ ] **Step 2: Commit**

```bash
git add src/main/config-service.ts
git commit -m "Add remoteHosts to config persistence"
```

---

### Task 4: Update SessionManager for Remote

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Add SshService integration**

In `src/main/session-manager.ts`:

Add import and field:
```typescript
import type { SshService } from './ssh-service'
```

Add field after `configService`:
```typescript
  private sshService: SshService | null = null
```

Add method:
```typescript
  setSshService(service: SshService): void {
    this.sshService = service
  }
```

Add a private helper for running tmux commands locally or remotely:
```typescript
  private tmuxCmd(remoteHost: string | undefined, ...args: string[]): string | null {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      if (!hostConfig) return null
      return this.sshService.exec(hostConfig.host, `tmux ${args.join(' ')}`)
    }
    return tmux(...args)
  }
```

- [ ] **Step 2: Update list() to include remote sessions**

Add a method `listRemote(hostName: string, sshHost: string)` that runs `tmux list-sessions` via SSH and returns sessions tagged with `remoteHost: hostName`. Follow the same pattern as the local listing but use `this.sshService.exec()`.

Update the main `list()` method to also call `listRemote()` for each configured remote host and merge results.

In the remote listing, discovered sessions get:
- `remoteHost: hostName`
- Color from config or auto-assigned
- Type from config or default 'claude'

- [ ] **Step 3: Update create() to support remote**

In `create()`, check `opts.remoteHost`. If set, use `this.tmuxCmd(opts.remoteHost, ...)` instead of `tmux(...)` for `new-session`, `set-option`, and `has-session`. Also tag the created session with `remoteHost: opts.remoteHost`.

- [ ] **Step 4: Update kill() to support remote**

In `kill()`, get the session's `remoteHost` and use `this.tmuxCmd(session.remoteHost, ...)` for `kill-session`.

- [ ] **Step 5: Add getTmuxNameAndHost() for PTY attach**

Add method:
```typescript
  getSessionInfo(id: string): { tmuxName: string; remoteHost?: string } | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    const hostConfig = session.remoteHost
      ? this.configService?.get().remoteHosts?.find(h => h.name === session.remoteHost)
      : undefined
    return {
      tmuxName: PREFIX + session.name,
      remoteHost: hostConfig?.host
    }
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "Add remote session support to SessionManager via SshService"
```

---

### Task 5: Update PtyManager for Remote Attach

**Files:**
- Modify: `src/main/pty-manager.ts`

- [ ] **Step 1: Update attach() to accept remoteHost**

Change `attach` signature:
```typescript
  attach(sessionId: string, tmuxSessionName: string, remoteHost?: string): void
```

If `remoteHost` is set, spawn SSH instead of local tmux:
```typescript
    let ptyArgs: string[]
    if (remoteHost) {
      const controlPath = join(process.env.HOME ?? '', '.ccc', `ssh-%r@%h:%p`)
      ptyArgs = ['-lc', `ssh -t -o ControlMaster=auto -o 'ControlPath=${controlPath}' -o ControlPersist=300 ${remoteHost} "tmux attach-session -d -t '=${tmuxSessionName}'"` ]
    } else {
      ptyArgs = ['-lc', `tmux attach-session -d -t '=${tmuxSessionName}'`]
    }

    const ptyProcess = pty.spawn(shell, ptyArgs, { ... })
```

- [ ] **Step 2: Commit**

```bash
git add src/main/pty-manager.ts
git commit -m "Support remote attach via SSH in PtyManager"
```

---

### Task 6: Host IPC and Wire Up Main Process

**Files:**
- Create: `src/main/ipc/host.ts`
- Modify: `src/main/ipc/session.ts`
- Modify: `src/main/ipc/terminal.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create host IPC**

Write `src/main/ipc/host.ts`:
```typescript
import { ipcMain } from 'electron'
import type { SshService } from '../ssh-service'

export function registerHostIpc(sshService: SshService): void {
  ipcMain.handle('host:statuses', () => {
    return sshService.getStatuses()
  })
}
```

- [ ] **Step 2: Update session IPC to pass remoteHost**

In `src/main/ipc/terminal.ts`, update the `session:attach` handler to use `getSessionInfo()`:

```typescript
  ipcMain.on('session:attach', (_event, id: string) => {
    const info = sessionManager.getSessionInfo(id)
    if (info) {
      ptyManager.attach(id, info.tmuxName, info.remoteHost)
    }
  })
```

- [ ] **Step 3: Wire SshService into main process**

In `src/main/index.ts`:
- Import SshService, registerHostIpc
- Instantiate: `const sshService = new SshService()`
- After `configService.load()`: `sessionManager.setSshService(sshService)`
- After `createWindow()`: `sshService.setWindow(mainWindow)` and start monitoring:
```typescript
  const remoteHosts = configService.get().remoteHosts ?? []
  if (remoteHosts.length > 0) {
    sshService.startMonitoring(remoteHosts)
  }
```
- Register: `registerHostIpc(sshService)`
- On `window-all-closed`: `sshService.stopMonitoring()`

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/host.ts src/main/ipc/session.ts src/main/ipc/terminal.ts src/main/index.ts
git commit -m "Wire SshService into main process with host IPC and monitoring"
```

---

### Task 7: Update Preload with Host API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add host API**

Add to the `api` object:
```typescript
  host: {
    statuses: () => ipcRenderer.invoke('host:statuses'),
    onStatusChanged: (callback: (name: string, online: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, name: string, online: boolean): void => {
        callback(name, online)
      }
      ipcRenderer.on('host:status-changed', handler)
      return () => ipcRenderer.removeListener('host:status-changed', handler)
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "Add host status API to preload"
```

---

### Task 8: Update Store with Remote State

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add host statuses and remote hosts to store**

Import `RemoteHost` type. Add to interface and initial state:
```typescript
  hostStatuses: Record<string, boolean>
  remoteHosts: RemoteHost[]

  loadHostStatuses: () => Promise<void>
  updateHostStatus: (name: string, online: boolean) => void
```

Initial state:
```typescript
  hostStatuses: {},
  remoteHosts: [],
```

In `loadConfig`, also set remoteHosts:
```typescript
  remoteHosts: config.remoteHosts ?? []
```

Add actions:
```typescript
  loadHostStatuses: async () => {
    const statuses = await window.cccAPI.host.statuses()
    set({ hostStatuses: statuses })
  },
  updateHostStatus: (name, online) => {
    set((state) => ({
      hostStatuses: { ...state.hostStatuses, [name]: online }
    }))
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "Add host statuses and remote hosts to session store"
```

---

### Task 9: Update App.tsx with Host Monitoring

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add host status loading and listener**

Get `loadHostStatuses` and `updateHostStatus` from store.

In useEffect, after loadConfig:
```typescript
    loadConfig().then(() => {
      loadSessions()
      loadHostStatuses()
    })
```

Add host status change listener:
```typescript
    const unsubHost = window.cccAPI.host.onStatusChanged((name, online) => {
      updateHostStatus(name, online)
    })
```

Return cleanup: `unsubHost()`.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "Load host statuses and listen for changes on startup"
```

---

### Task 10: Update Sidebar with Machine Headers

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Group sessions by host when remote hosts exist**

In SessionSidebar, get `remoteHosts` and `hostStatuses` from store.

If `remoteHosts.length > 0`, render sessions grouped by host:
- "Local" header for sessions without `remoteHost`
- One header per remote host with online/offline badge
- Each header is collapsible
- Under each host header, show category groups (Claude/Gemini/Shell) as before

If no remote hosts configured, render current flat category view (no change).

The host header shows:
```tsx
<button className="w-full flex items-center gap-1.5 px-2 py-1 ...">
  <ChevronDown/Right />
  <span className="text-[11px] font-semibold">{hostName}</span>
  {!online && <span className="text-[9px] font-medium" style={{ color: 'var(--error)' }}>offline</span>}
  <span className="text-[10px] ml-auto">{sessionCount}</span>
</button>
```

Offline sessions rendered with `opacity: 0.4` and no click handler.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "Group sessions under machine headers when remote hosts exist"
```

---

### Task 11: Update NewSessionModal with Host Selector

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add "Where" selector**

Get `remoteHosts` and `hostStatuses` from store.

If `remoteHosts.length > 0`, add a "Where" section above "Type":
```tsx
<div>
  <label ...>Where</label>
  <div className="flex flex-wrap gap-2">
    <button onClick={() => setRemoteHost(undefined)} ...>Local</button>
    {remoteHosts.map(h => (
      <button
        key={h.name}
        onClick={() => setRemoteHost(h.name)}
        disabled={!hostStatuses[h.name]}
        ...
      >
        {h.name}
        {!hostStatuses[h.name] && <span>offline</span>}
      </button>
    ))}
  </div>
</div>
```

Add `remoteHost` to local state: `const [remoteHost, setRemoteHost] = useState<string | undefined>(undefined)`

Pass `remoteHost` to `createSession()`.

When a remote host is selected, show that host's favorites instead of local ones:
```typescript
const activeFavorites = remoteHost
  ? remoteHosts.find(h => h.name === remoteHost)?.favoriteFolders ?? []
  : favorites
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx
git commit -m "Add host selector and per-host favorites to NewSessionModal"
```

---

### Task 12: Update SessionCard + SessionTopBar with Remote Indicator

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`
- Modify: `src/renderer/components/SessionTopBar.tsx`
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add remote indicator to SessionCard**

In SessionCard, if `session.remoteHost`, show a small host badge after the name:
```tsx
{session.remoteHost && (
  <span className="text-[8px] px-1 py-px rounded font-medium flex-shrink-0"
    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
    {session.remoteHost}
  </span>
)}
```

- [ ] **Step 2: Add host name to SessionTopBar**

In SessionTopBar, show host name for remote sessions between session name and status:
```tsx
{session.remoteHost && (
  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
    {session.remoteHost}
  </span>
)}
```

- [ ] **Step 3: Add Remote Hosts tab to SettingsModal**

Add `'remotes'` to the Tab type. Add tab button "Remote Hosts".

Content: list of remote hosts with name, SSH host, per-host favorites. Add/edit/delete inline (same pattern as favorites tab). Connection test button per host.

Save via `config:update({ remoteHosts })`.

- [ ] **Step 4: Verify build**

```bash
npx electron-vite build
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SessionCard.tsx src/renderer/components/SessionTopBar.tsx src/renderer/components/SettingsModal.tsx
git commit -m "Add remote indicators, host settings tab, and remote host management"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Types | types.ts |
| 2 | SshService | ssh-service.ts |
| 3 | Config remoteHosts | config-service.ts |
| 4 | SessionManager remote | session-manager.ts |
| 5 | PtyManager remote attach | pty-manager.ts |
| 6 | Host IPC + wiring | ipc/host.ts, index.ts |
| 7 | Preload host API | preload/index.ts |
| 8 | Store host state | session-store.ts |
| 9 | App host monitoring | App.tsx |
| 10 | Sidebar machine headers | SessionSidebar.tsx |
| 11 | Modal host selector | NewSessionModal.tsx |
| 12 | Remote indicators + settings | SessionCard, TopBar, Settings |
