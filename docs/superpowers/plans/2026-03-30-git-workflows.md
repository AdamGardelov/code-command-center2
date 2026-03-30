# Git & Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add worktree management and session groups to CCC2 so users can create git worktrees from the UI and see sessions grouped by repo or custom grouping.

**Architecture:** New GitService handles all git operations (worktree add/remove/list, branch listing) for both local and remote hosts. Session groups are persisted in config and computed (auto-groups) from worktree/repo detection. Sidebar nests groups inside machine headers.

**Tech Stack:** Electron IPC, node `execFileSync`, git CLI, React/Zustand, Tailwind CSS

---

### Task 1: Add new types to shared/types.ts

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add Worktree and SessionGroup types, extend existing interfaces**

```typescript
// Add after RemoteHost interface (line 41):

export interface SessionGroup {
  id: string
  name: string
  sessionIds: string[]
}

export interface Worktree {
  path: string
  branch: string
  isMain: boolean
  repoPath: string
}
```

Extend `FavoriteFolder`:
```typescript
export interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
  worktreePath?: string
}
```

Extend `RemoteHost`:
```typescript
export interface RemoteHost {
  name: string
  host: string
  worktreeBasePath?: string
  favoriteFolders: FavoriteFolder[]
}
```

Extend `Session`:
```typescript
export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: SessionStatus
  type: SessionType
  color: string
  remoteHost?: string
  gitBranch?: string
  groupId?: string
  repoPath?: string
  createdAt: number
  lastActiveAt: number
}
```

Extend `CccConfig`:
```typescript
export interface CccConfig {
  theme: Theme
  sidebarWidth: number
  worktreeBasePath: string
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
  sessionTypes: Record<string, SessionType>
  enabledProviders: AiProvider[]
  remoteHosts: RemoteHost[]
  sessionGroups: SessionGroup[]
}
```

Extend `CccAPI` — add `git` and `group` namespaces:
```typescript
export interface CccAPI {
  // ...existing window, session, terminal, state, config, host...
  git: {
    listWorktrees: (repoPath: string, remoteHost?: string) => Promise<Worktree[]>
    addWorktree: (repoPath: string, branch: string, targetPath: string, remoteHost?: string) => Promise<Worktree>
    removeWorktree: (worktreePath: string, remoteHost?: string) => Promise<void>
    listBranches: (repoPath: string, remoteHost?: string) => Promise<string[]>
  }
  group: {
    create: (name: string) => Promise<SessionGroup>
    delete: (groupId: string) => Promise<void>
    addSession: (groupId: string, sessionId: string) => Promise<void>
    removeSession: (groupId: string, sessionId: string) => Promise<void>
  }
}
```

- [ ] **Step 2: Verify the project still compiles**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: Build errors because ConfigService and preload don't match the new types yet. That's fine — we'll fix them in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "Add Worktree, SessionGroup types and extend Session/Config/API interfaces"
```

---

### Task 2: Update ConfigService for new config fields

**Files:**
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Update DEFAULT_CONFIG and load() to handle new fields**

In `config-service.ts`, update `DEFAULT_CONFIG` (line 8):
```typescript
const DEFAULT_CONFIG: CccConfig = {
  theme: 'dark',
  sidebarWidth: 260,
  worktreeBasePath: '~/worktrees',
  favoriteFolders: [],
  sessionColors: {},
  sessionTypes: {},
  enabledProviders: ['claude'],
  remoteHosts: [],
  sessionGroups: []
}
```

In the `load()` method, add parsing for the new fields inside the config merge (after line 40):
```typescript
worktreeBasePath: typeof parsed.worktreeBasePath === 'string' ? parsed.worktreeBasePath : '~/worktrees',
sessionGroups: Array.isArray(parsed.sessionGroups) ? parsed.sessionGroups : []
```

In the `update()` method, add handling for the new fields (after line 75):
```typescript
if (partial.worktreeBasePath !== undefined) this.config.worktreeBasePath = partial.worktreeBasePath
if (partial.sessionGroups !== undefined) this.config.sessionGroups = partial.sessionGroups
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: May still have errors from preload — that's OK.

- [ ] **Step 3: Commit**

```bash
git add src/main/config-service.ts
git commit -m "Add worktreeBasePath and sessionGroups to config persistence"
```

---

### Task 3: Create GitService

**Files:**
- Create: `src/main/git-service.ts`

- [ ] **Step 1: Create the GitService**

```typescript
import { execFileSync } from 'child_process'
import { basename } from 'path'
import type { Worktree, CccConfig } from '../shared/types'
import type { SshService } from './ssh-service'

export class GitService {
  private sshService: SshService | null = null
  private configService: { get(): CccConfig } | null = null

  setSshService(service: SshService): void {
    this.sshService = service
  }

  setConfigService(service: { get(): CccConfig }): void {
    this.configService = service
  }

  private exec(args: string[], remoteHost?: string): string | null {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      if (!hostConfig) return null
      const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
      return this.sshService.exec(hostConfig.host, `git ${escaped}`)
    }
    try {
      return execFileSync('git', args, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
    } catch {
      return null
    }
  }

  listWorktrees(repoPath: string, remoteHost?: string): Worktree[] {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const output = this.exec(['-C', expanded, 'worktree', 'list', '--porcelain'], remoteHost)
    if (!output) return []

    const worktrees: Worktree[] = []
    let current: Partial<Worktree> = {}

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as Worktree)
        current = { path: line.slice(9), isMain: false, repoPath: expanded }
      } else if (line.startsWith('branch refs/heads/')) {
        current.branch = line.slice(18)
      } else if (line === 'bare') {
        current.branch = '(bare)'
      } else if (line.startsWith('HEAD ')) {
        // detached HEAD — use short hash
        if (!current.branch) current.branch = '(detached)'
      } else if (line === '') {
        // empty line separates entries — first worktree is main
        if (current.path && worktrees.length === 0 && Object.keys(current).length > 1) {
          current.isMain = true
        }
      }
    }
    // Push last entry
    if (current.path) {
      if (worktrees.length === 0) current.isMain = true
      worktrees.push(current as Worktree)
    }

    return worktrees
  }

  addWorktree(repoPath: string, branch: string, targetPath: string, remoteHost?: string): Worktree {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const expandedTarget = remoteHost ? targetPath : targetPath.replace(/^~/, process.env.HOME ?? '')

    // Try to create worktree with existing branch first, fall back to new branch
    let result = this.exec(['-C', expanded, 'worktree', 'add', expandedTarget, branch], remoteHost)
    if (result === null) {
      result = this.exec(['-C', expanded, 'worktree', 'add', '-b', branch, expandedTarget], remoteHost)
    }
    if (result === null) {
      throw new Error(`Failed to create worktree for branch "${branch}" at ${targetPath}`)
    }

    return {
      path: expandedTarget,
      branch,
      isMain: false,
      repoPath: expanded
    }
  }

  removeWorktree(worktreePath: string, remoteHost?: string): void {
    const expanded = remoteHost ? worktreePath : worktreePath.replace(/^~/, process.env.HOME ?? '')
    const result = this.exec(['worktree', 'remove', expanded], remoteHost)
    if (result === null) {
      // Force remove if regular remove fails
      this.exec(['worktree', 'remove', '--force', expanded], remoteHost)
    }
  }

  getBranch(dir: string, remoteHost?: string): string | null {
    const expanded = remoteHost ? dir : dir.replace(/^~/, process.env.HOME ?? '')
    const result = this.exec(['-C', expanded, 'rev-parse', '--abbrev-ref', 'HEAD'], remoteHost)
    return result || null
  }

  listBranches(repoPath: string, remoteHost?: string): string[] {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const output = this.exec(['-C', expanded, 'branch', '-a', '--format=%(refname:short)'], remoteHost)
    if (!output) return []
    return output.split('\n').filter(b => b.length > 0)
  }

  getRepoRoot(dir: string, remoteHost?: string): string | null {
    const expanded = remoteHost ? dir : dir.replace(/^~/, process.env.HOME ?? '')
    return this.exec(['-C', expanded, 'rev-parse', '--show-toplevel'], remoteHost)
  }

  resolveWorktreePath(repoPath: string, branch: string, remoteHost?: string): string {
    const config = this.configService?.get()
    if (!config) return `${repoPath}/../${basename(repoPath)}-worktrees/${branch}`

    // 1. Check if repo has worktreePath in favorites
    const allFavorites = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.favoriteFolders ?? []
      : config.favoriteFolders
    const matchingFav = allFavorites.find(f => {
      const expandedFav = f.path.replace(/^~/, process.env.HOME ?? '')
      const expandedRepo = repoPath.replace(/^~/, process.env.HOME ?? '')
      return expandedFav === expandedRepo || f.path === repoPath
    })
    if (matchingFav?.worktreePath) {
      return `${matchingFav.worktreePath}/${branch}`
    }

    // 2. Check host or global worktreeBasePath
    const hostBasePath = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.worktreeBasePath
      : undefined
    const basePath = hostBasePath ?? config.worktreeBasePath
    if (basePath) {
      const repoName = basename(repoPath)
      return `${basePath}/${repoName}/${branch}`
    }

    // 3. Fallback
    const repoName = basename(repoPath)
    return `${repoPath}/../${repoName}-worktrees/${branch}`
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: Builds (file is not imported yet).

- [ ] **Step 3: Commit**

```bash
git add src/main/git-service.ts
git commit -m "Add GitService with worktree and branch operations"
```

---

### Task 4: Create Git IPC handler

**Files:**
- Create: `src/main/ipc/git.ts`

- [ ] **Step 1: Create the IPC handler**

```typescript
import { ipcMain } from 'electron'
import type { GitService } from '../git-service'

export function registerGitIpc(gitService: GitService): void {
  ipcMain.handle('git:list-worktrees', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.listWorktrees(repoPath, remoteHost)
  })

  ipcMain.handle('git:add-worktree', async (_event, repoPath: string, branch: string, targetPath: string, remoteHost?: string) => {
    return gitService.addWorktree(repoPath, branch, targetPath, remoteHost)
  })

  ipcMain.handle('git:remove-worktree', async (_event, worktreePath: string, remoteHost?: string) => {
    return gitService.removeWorktree(worktreePath, remoteHost)
  })

  ipcMain.handle('git:list-branches', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.listBranches(repoPath, remoteHost)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc/git.ts
git commit -m "Add git IPC handlers for worktree and branch operations"
```

---

### Task 5: Create Group IPC handler

**Files:**
- Create: `src/main/ipc/group.ts`

- [ ] **Step 1: Create the IPC handler**

```typescript
import { ipcMain } from 'electron'
import type { ConfigService } from '../config-service'
import type { SessionGroup } from '../../shared/types'

export function registerGroupIpc(configService: ConfigService): void {
  ipcMain.handle('group:create', async (_event, name: string): Promise<SessionGroup> => {
    const config = configService.get()
    const group: SessionGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      sessionIds: []
    }
    configService.update({
      sessionGroups: [...(config.sessionGroups ?? []), group]
    })
    return group
  })

  ipcMain.handle('group:delete', async (_event, groupId: string): Promise<void> => {
    const config = configService.get()
    configService.update({
      sessionGroups: (config.sessionGroups ?? []).filter(g => g.id !== groupId)
    })
  })

  ipcMain.handle('group:add-session', async (_event, groupId: string, sessionId: string): Promise<void> => {
    const config = configService.get()
    const groups = (config.sessionGroups ?? []).map(g => {
      if (g.id === groupId && !g.sessionIds.includes(sessionId)) {
        return { ...g, sessionIds: [...g.sessionIds, sessionId] }
      }
      return g
    })
    configService.update({ sessionGroups: groups })
  })

  ipcMain.handle('group:remove-session', async (_event, groupId: string, sessionId: string): Promise<void> => {
    const config = configService.get()
    const groups = (config.sessionGroups ?? []).map(g => {
      if (g.id === groupId) {
        return { ...g, sessionIds: g.sessionIds.filter(id => id !== sessionId) }
      }
      return g
    })
    configService.update({ sessionGroups: groups })
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc/group.ts
git commit -m "Add group IPC handlers for session group CRUD"
```

---

### Task 6: Wire GitService and new IPC into main process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Import and initialize GitService, register new IPC handlers**

Add imports after existing imports (after line 21):
```typescript
import { GitService } from './git-service'
import { registerGitIpc } from './ipc/git'
import { registerGroupIpc } from './ipc/group'
```

After `const sshService = new SshService()` (line 26), add:
```typescript
const gitService = new GitService()
gitService.setSshService(sshService)
gitService.setConfigService(configService)
```

After `registerHostIpc(sshService)` (line 101), add:
```typescript
registerGitIpc(gitService)
registerGroupIpc(configService)
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: May still fail due to preload type mismatch — next task fixes that.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "Wire GitService and group IPC into main process"
```

---

### Task 7: Update preload with git and group APIs

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add git and group namespaces to the preload API**

Add new imports at the top (extend the existing import):
```typescript
import type { CccAPI, CccConfig, SessionCreate, SessionStatus, SessionGroup } from '../shared/types'
```

Add after the `host` namespace (before the closing `}` of the `api` object, around line 64):
```typescript
  git: {
    listWorktrees: (repoPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:list-worktrees', repoPath, remoteHost),
    addWorktree: (repoPath: string, branch: string, targetPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:add-worktree', repoPath, branch, targetPath, remoteHost),
    removeWorktree: (worktreePath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:remove-worktree', worktreePath, remoteHost),
    listBranches: (repoPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:list-branches', repoPath, remoteHost)
  },
  group: {
    create: (name: string): Promise<SessionGroup> => ipcRenderer.invoke('group:create', name),
    delete: (groupId: string): Promise<void> => ipcRenderer.invoke('group:delete', groupId),
    addSession: (groupId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('group:add-session', groupId, sessionId),
    removeSession: (groupId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('group:remove-session', groupId, sessionId)
  }
```

- [ ] **Step 2: Verify full build succeeds**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built in ~3s for all three targets (main, preload, renderer).

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "Add git and group APIs to preload bridge"
```

---

### Task 8: Update SessionManager for repoPath detection

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Add repoPath detection to session listing**

Add a helper function after `getGitBranch` (around line 60):
```typescript
function getRepoRoot(dir: string): string | undefined {
  try {
    const expanded = dir.replace(/^~/, process.env.HOME ?? '')
    return (
      execFileSync('git', ['-C', expanded, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}
```

In the `list()` method, where local sessions are updated (around line 175), add `repoPath` detection alongside the existing `gitBranch`:
```typescript
existing.gitBranch = getGitBranch(existing.workingDirectory)
existing.repoPath = getRepoRoot(existing.workingDirectory)
```

When creating new session entries in `list()` (around line 190), add:
```typescript
repoPath: getRepoRoot(currentPath || '~'),
```

In the `create()` method, when building the Session object (around line 283), add:
```typescript
repoPath: isRemote ? undefined : getRepoRoot(expandedDir),
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 3: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "Detect and persist repoPath on sessions for auto-grouping"
```

---

### Task 9: Update session store with groups and auto-grouping

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add group state and actions to the store**

Update the import to include new types:
```typescript
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder, AiProvider, RemoteHost, SessionGroup } from '../../shared/types'
```

Add to the `SessionStore` interface (after `remoteHosts: RemoteHost[]`):
```typescript
  sessionGroups: SessionGroup[]
  worktreeBasePath: string

  loadGroups: () => Promise<void>
  createGroup: (name: string) => Promise<SessionGroup>
  deleteGroup: (groupId: string) => Promise<void>
  addSessionToGroup: (groupId: string, sessionId: string) => Promise<void>
  removeSessionFromGroup: (groupId: string, sessionId: string) => Promise<void>
  getGroupedSessions: () => {
    groups: Array<{ group: SessionGroup | { id: string; name: string; auto: true }; sessionIds: string[] }>
    ungrouped: string[]
  }
```

Add initial state values:
```typescript
  sessionGroups: [],
  worktreeBasePath: '~/worktrees',
```

Update `loadConfig` to also load groups:
```typescript
  loadConfig: async () => {
    const config = await window.cccAPI.config.load()
    document.documentElement.setAttribute('data-theme', config.theme)
    set({
      theme: config.theme,
      sidebarWidth: config.sidebarWidth,
      favorites: config.favoriteFolders,
      enabledProviders: config.enabledProviders ?? ['claude'],
      remoteHosts: config.remoteHosts ?? [],
      sessionGroups: config.sessionGroups ?? [],
      worktreeBasePath: config.worktreeBasePath ?? '~/worktrees'
    })
  },
```

Add the new actions:
```typescript
  loadGroups: async () => {
    const config = await window.cccAPI.config.load()
    set({ sessionGroups: config.sessionGroups ?? [] })
  },

  createGroup: async (name) => {
    const group = await window.cccAPI.group.create(name)
    set((state) => ({ sessionGroups: [...state.sessionGroups, group] }))
    return group
  },

  deleteGroup: async (groupId) => {
    await window.cccAPI.group.delete(groupId)
    set((state) => ({
      sessionGroups: state.sessionGroups.filter(g => g.id !== groupId)
    }))
  },

  addSessionToGroup: async (groupId, sessionId) => {
    await window.cccAPI.group.addSession(groupId, sessionId)
    set((state) => ({
      sessionGroups: state.sessionGroups.map(g =>
        g.id === groupId && !g.sessionIds.includes(sessionId)
          ? { ...g, sessionIds: [...g.sessionIds, sessionId] }
          : g
      )
    }))
  },

  removeSessionFromGroup: async (groupId, sessionId) => {
    await window.cccAPI.group.removeSession(groupId, sessionId)
    set((state) => ({
      sessionGroups: state.sessionGroups.map(g =>
        g.id === groupId
          ? { ...g, sessionIds: g.sessionIds.filter(id => id !== sessionId) }
          : g
      )
    }))
  },

  getGroupedSessions: () => {
    const { sessions, sessionGroups } = get()
    const manuallyGrouped = new Set<string>()
    const groups: Array<{ group: SessionGroup | { id: string; name: string; auto: true }; sessionIds: string[] }> = []

    // Manual groups first
    for (const group of sessionGroups) {
      const validIds = group.sessionIds.filter(id => sessions.find(s => s.id === id))
      if (validIds.length > 0) {
        groups.push({ group, sessionIds: validIds })
        for (const id of validIds) manuallyGrouped.add(id)
      }
    }

    // Auto-groups from repoPath
    const repoMap = new Map<string, string[]>()
    for (const session of sessions) {
      if (manuallyGrouped.has(session.id) || !session.repoPath) continue
      const existing = repoMap.get(session.repoPath) ?? []
      existing.push(session.id)
      repoMap.set(session.repoPath, existing)
    }
    for (const [repoPath, sessionIds] of repoMap) {
      if (sessionIds.length >= 2) {
        const repoName = repoPath.split('/').pop() ?? repoPath
        groups.push({
          group: { id: `auto-${repoPath}`, name: repoName, auto: true },
          sessionIds
        })
        for (const id of sessionIds) manuallyGrouped.add(id)
      }
    }

    const ungrouped = sessions.filter(s => !manuallyGrouped.has(s.id)).map(s => s.id)
    return { groups, ungrouped }
  },
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "Add session group state and auto-grouping logic to store"
```

---

### Task 10: Update SessionSidebar with group nesting

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Add a SessionGroupSection component**

Add after the `Category` component (around line 68), before `MachineGroup`:

```typescript
interface SessionGroupSectionProps {
  name: string
  sessions: Session[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  isAuto?: boolean
}

function SessionGroupSection({ name, sessions, activeSessionId, onSelect, isAuto }: SessionGroupSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-0.5 ml-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]"
      >
        {open
          ? <ChevronDown size={9} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          : <ChevronRight size={9} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        }
        <GitBranch size={9} style={{ color: isAuto ? 'var(--text-muted)' : 'var(--accent)' }} className="flex-shrink-0" />
        <span
          className="text-[10px] font-semibold flex-1 text-left truncate"
          style={{ color: isAuto ? 'var(--text-muted)' : 'var(--text-secondary)' }}
        >
          {name}
        </span>
        <span className="text-[9px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {sessions.length}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 mt-0.5 ml-1">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => onSelect(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

Add `GitBranch` to the lucide-react import at line 1:
```typescript
import { Plus, LayoutGrid, Monitor, PanelLeftClose, Settings, SquareTerminal, ChevronDown, ChevronRight, Search, Server, GitBranch } from 'lucide-react'
```

- [ ] **Step 2: Update MachineGroup to render groups inside it**

Replace the body of `MachineGroup` (the part inside `{open && (` block, around lines 116-147) to support groups:

```typescript
function MachineGroup({ name, online, isLocal, sessions, activeSessionId, onSelect }: MachineGroupProps): React.JSX.Element {
  const [open, setOpen] = useState(true)
  const getGroupedSessions = useSessionStore((s) => s.getGroupedSessions)

  const { groups, ungrouped } = getGroupedSessions()

  // Filter groups and ungrouped to only sessions in this machine
  const machineSessionIds = new Set(sessions.map(s => s.id))
  const machineGroups = groups
    .map(g => ({
      ...g,
      sessionIds: g.sessionIds.filter(id => machineSessionIds.has(id))
    }))
    .filter(g => g.sessionIds.length > 0)
  const machineUngrouped = ungrouped.filter(id => machineSessionIds.has(id))

  const ungroupedSessions = machineUngrouped
    .map(id => sessions.find(s => s.id === id))
    .filter((s): s is Session => !!s)

  const claudeUngrouped = ungroupedSessions.filter(s => s.type === 'claude')
  const geminiUngrouped = ungroupedSessions.filter(s => s.type === 'gemini')
  const shellUngrouped = ungroupedSessions.filter(s => s.type === 'shell')

  return (
    <div className="mb-1" style={{ opacity: online ? 1 : 0.4 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]"
      >
        {open
          ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        }
        <Server size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wide flex-1 text-left" style={{ color: 'var(--text-secondary)' }}>
          {name}
        </span>
        {!isLocal && (
          <span
            className="text-[8px] px-1 py-px rounded font-medium"
            style={{
              color: online ? 'var(--success)' : 'var(--text-muted)',
              backgroundColor: online ? 'var(--success)' + '20' : 'var(--bg-raised)'
            }}
          >
            {online ? 'online' : 'offline'}
          </span>
        )}
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {sessions.length}
        </span>
      </button>
      {open && (
        <div className="ml-1">
          {machineGroups.map(({ group, sessionIds }) => {
            const groupSessions = sessionIds
              .map(id => sessions.find(s => s.id === id))
              .filter((s): s is Session => !!s)
            return (
              <SessionGroupSection
                key={group.id}
                name={group.name}
                sessions={groupSessions}
                activeSessionId={activeSessionId}
                onSelect={onSelect}
                isAuto={'auto' in group}
              />
            )
          })}
          {claudeUngrouped.length > 0 && (
            <Category
              icon={<ClaudeIcon size={12} />}
              label="Claude Code"
              count={claudeUngrouped.length}
              sessions={claudeUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {geminiUngrouped.length > 0 && (
            <Category
              icon={<GeminiIcon size={12} />}
              label="Gemini"
              count={geminiUngrouped.length}
              sessions={geminiUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {shellUngrouped.length > 0 && (
            <Category
              icon={<SquareTerminal size={11} style={{ color: 'var(--text-secondary)' }} />}
              label="Shell"
              count={shellUngrouped.length}
              sessions={shellUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "Add session group nesting inside machine headers in sidebar"
```

---

### Task 11: Add worktree flow to NewSessionModal

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add worktree mode state and branch loading**

Add `GitBranch` to the lucide-react import:
```typescript
import { X, SquareTerminal, Server, Monitor, GitBranch } from 'lucide-react'
```

Add new state variables inside the component (after `const [error, setError]` around line 36):
```typescript
  const [worktreeMode, setWorktreeMode] = useState(false)
  const [branch, setBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
```

Add a function to load branches when a favorite is selected (inside the component, before `handleSubmit`):
```typescript
  const loadBranches = async (repoPath: string): Promise<void> => {
    setLoadingBranches(true)
    try {
      const branchList = await window.cccAPI.git.listBranches(repoPath, remoteHost)
      setBranches(branchList)
    } catch {
      setBranches([])
    } finally {
      setLoadingBranches(false)
    }
  }
```

- [ ] **Step 2: Update favorite click handler to also load branches**

Find the favorite button's onClick (around line 121):
```typescript
onClick={() => { setName(fav.name); setWorkingDirectory(fav.path) }}
```
Replace with:
```typescript
onClick={() => {
  setName(fav.name)
  setWorkingDirectory(fav.path)
  void loadBranches(fav.path)
}}
```

- [ ] **Step 3: Update handleSubmit to support worktree creation**

Replace the `handleSubmit` function body (the try block) with:
```typescript
    try {
      let dir = workingDirectory.trim() || '~'

      if (worktreeMode && branch.trim()) {
        // Create worktree first, then start session in it
        const worktree = await window.cccAPI.git.addWorktree(
          workingDirectory.trim(),
          branch.trim(),
          '', // empty targetPath means GitService resolves it
          remoteHost
        )
        dir = worktree.path
      }

      await createSession({
        name: name.trim(),
        workingDirectory: dir,
        type,
        remoteHost
      })
      setName('')
      setWorkingDirectory('')
      setType(enabledProviders[0] ?? 'claude')
      setRemoteHost(undefined)
      setWorktreeMode(false)
      setBranch('')
      setBranches([])
      toggleModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
```

Wait — the `addWorktree` IPC needs a `targetPath`. We should compute it on the backend. Update the `handleSubmit` to let the backend resolve the path. Actually, looking at the IPC, `targetPath` is required. Let's pass an empty string and handle it in GitService, OR compute it client-side.

Better approach: add a `resolveWorktreePath` IPC call. But that adds complexity. Simpler: compute it in the IPC handler when `targetPath` is empty.

Update `src/main/ipc/git.ts` — the `git:add-worktree` handler:
```typescript
  ipcMain.handle('git:add-worktree', async (_event, repoPath: string, branch: string, targetPath: string, remoteHost?: string) => {
    const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost)
    return gitService.addWorktree(repoPath, branch, resolvedPath, remoteHost)
  })
```

- [ ] **Step 4: Add worktree toggle and branch input UI**

Add after the Working Directory input (after line 252, before the error display), inside the form:
```typescript
          {workingDirectory.trim() && type !== 'shell' && (
            <div>
              <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWorktreeMode(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                  style={{
                    backgroundColor: !worktreeMode ? 'var(--accent-muted)' : 'transparent',
                    borderColor: !worktreeMode ? 'var(--accent)' : 'var(--bg-raised)',
                    color: !worktreeMode ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  Open in repo
                </button>
                <button
                  type="button"
                  onClick={() => setWorktreeMode(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                  style={{
                    backgroundColor: worktreeMode ? 'var(--accent-muted)' : 'transparent',
                    borderColor: worktreeMode ? 'var(--accent)' : 'var(--bg-raised)',
                    color: worktreeMode ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  <GitBranch size={12} />
                  New worktree
                </button>
              </div>
            </div>
          )}

          {worktreeMode && (
            <div>
              <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. feature-auth"
                list="branch-suggestions"
                className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              />
              {branches.length > 0 && (
                <datalist id="branch-suggestions">
                  {branches.map(b => <option key={b} value={b} />)}
                </datalist>
              )}
              {loadingBranches && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Loading branches...</p>
              )}
            </div>
          )}
```

- [ ] **Step 5: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx src/main/ipc/git.ts
git commit -m "Add worktree creation flow to NewSessionModal with branch autocomplete"
```

---

### Task 12: Add GroupContextMenu component

**Files:**
- Create: `src/renderer/components/GroupContextMenu.tsx`

- [ ] **Step 1: Create the context menu component**

```typescript
import { useState } from 'react'
import { useSessionStore } from '../stores/session-store'

interface GroupContextMenuProps {
  sessionId: string
  x: number
  y: number
  onClose: () => void
}

export default function GroupContextMenu({ sessionId, x, y, onClose }: GroupContextMenuProps): React.JSX.Element {
  const sessionGroups = useSessionStore((s) => s.sessionGroups)
  const createGroup = useSessionStore((s) => s.createGroup)
  const addSessionToGroup = useSessionStore((s) => s.addSessionToGroup)
  const removeSessionFromGroup = useSessionStore((s) => s.removeSessionFromGroup)
  const [newGroupName, setNewGroupName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const currentGroup = sessionGroups.find(g => g.sessionIds.includes(sessionId))

  const handleAddToGroup = async (groupId: string): Promise<void> => {
    // Remove from current group first if in one
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    await addSessionToGroup(groupId, sessionId)
    onClose()
  }

  const handleCreateAndAdd = async (): Promise<void> => {
    if (!newGroupName.trim()) return
    const group = await createGroup(newGroupName.trim())
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    await addSessionToGroup(group.id, sessionId)
    onClose()
  }

  const handleRemove = async (): Promise<void> => {
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg border py-1 min-w-[160px]"
        style={{
          left: x,
          top: y,
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        {currentGroup && (
          <button
            onClick={handleRemove}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Remove from "{currentGroup.name}"
          </button>
        )}

        {sessionGroups.filter(g => g.id !== currentGroup?.id).map(g => (
          <button
            key={g.id}
            onClick={() => void handleAddToGroup(g.id)}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Move to "{g.name}"
          </button>
        ))}

        <div className="border-t my-1" style={{ borderColor: 'var(--bg-raised)' }} />

        {showNew ? (
          <div className="px-2 py-1 flex gap-1">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreateAndAdd()}
              placeholder="Group name"
              autoFocus
              className="flex-1 px-2 py-1 rounded text-[11px] border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--accent)' }}
          >
            New group...
          </button>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built (file not imported yet).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/GroupContextMenu.tsx
git commit -m "Add GroupContextMenu for session group management"
```

---

### Task 13: Wire context menu into SessionCard

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`

- [ ] **Step 1: Add right-click handler and context menu state**

Add import at the top:
```typescript
import { useState } from 'react'
import GroupContextMenu from './GroupContextMenu'
```

Add state inside the component (after `const removeSession`):
```typescript
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
```

Add right-click handler on the button element — add `onContextMenu` prop:
```typescript
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
```

Add context menu rendering at the end, just before the closing `</button>` (actually after, since we need it outside the button for z-index):

Wrap the entire return in a fragment and add the context menu after the button:
```typescript
  return (
    <>
      <button
        {/* ...existing button content... */}
      </button>
      {contextMenu && (
        <GroupContextMenu
          sessionId={session.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
```

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SessionCard.tsx
git commit -m "Add right-click context menu for session group management"
```

---

### Task 14: Add worktree settings to SettingsModal

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add worktreeBasePath field to the settings**

Add `worktreeBasePath` to the store selectors at the top of the component:
```typescript
  const worktreeBasePath = useSessionStore((s) => s.worktreeBasePath)
```

Add a new "Worktrees" tab option — update the `Tab` type:
```typescript
type Tab = 'providers' | 'favorites' | 'appearance' | 'remotes' | 'worktrees'
```

Add the tab button in the tab bar (alongside existing tab buttons). Then add the tab content panel:

```typescript
        {tab === 'worktrees' && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                Default Worktree Base Path
              </label>
              <input
                type="text"
                defaultValue={worktreeBasePath}
                onBlur={(e) => {
                  void window.cccAPI.config.update({ worktreeBasePath: e.target.value })
                }}
                placeholder="~/worktrees"
                className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Worktrees will be created at: {worktreeBasePath}/{'<repo>/<branch>'}
              </p>
            </div>
          </div>
        )}
```

Also, add `worktreePath` field to each favorite folder's edit form in the Favorites tab. In the favorite edit form, after the `defaultBranch` input, add:
```typescript
              <input
                type="text"
                value={editForm.worktreePath ?? ''}
                onChange={(e) => setEditForm({ ...editForm, worktreePath: e.target.value || undefined })}
                placeholder="Worktree path override (optional)"
                className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              />
```

Update the `editForm` state type to include `worktreePath`:
```typescript
  const [editForm, setEditForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
```
This already works since `FavoriteFolder` now has `worktreePath?: string`.

For the Remote Hosts tab, add `worktreeBasePath` field to each host's edit form.

- [ ] **Step 2: Verify build**

Run: `npx electron-vite build 2>&1 | tail -5`

Expected: ✓ built successfully.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "Add worktree path settings to favorites, remote hosts, and global config"
```

---

### Task 15: Manual test and polish

**Files:**
- No new files

- [ ] **Step 1: Run the app and verify core flows**

Run: `npm run dev`

Test checklist:
1. Open Settings → Worktrees tab → verify base path shows `~/worktrees`
2. Open Settings → Favorites → verify worktree path override field appears
3. Create a new session from a favorite → verify "Open in repo" / "New worktree" toggle appears
4. Select "New worktree" → verify branch input appears with autocomplete
5. Create a worktree session → verify `git worktree add` runs and session starts in the new directory
6. Create two sessions in the same repo → verify they auto-group in sidebar
7. Right-click a session → verify context menu with group options appears
8. Create a manual group → verify it appears in sidebar
9. Move a session between groups → verify sidebar updates

- [ ] **Step 2: Fix any issues found during testing**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "Polish git workflows: fix issues found during manual testing"
```
