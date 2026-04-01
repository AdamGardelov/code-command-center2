# Container Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Docker container session support — sessions run `docker exec` inside tmux, with UI for configuration and visual indicators.

**Architecture:** Feature flag `enableContainers` gates all behavior. `ContainerService` checks container status via `docker inspect` (local or SSH-tunneled). Session creation wraps the command with `docker exec`. UI shows `Box` icon + container badge.

**Tech Stack:** TypeScript, Electron IPC, node-pty, Zustand, React, Lucide React, Tailwind CSS

---

### Task 1: Extend type definitions

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add ContainerConfig interface and extend Session, SessionCreate, CccConfig, FeaturesConfig**

Add after the `RemoteHost` interface (after line 48):

```typescript
export interface ContainerConfig {
  name: string
  label?: string
  remoteHost?: string
}
```

Add to the `Session` interface (after line 20, before the closing `}`):

```typescript
  isContainer?: boolean
  containerName?: string
```

Add to the `SessionCreate` interface (after line 28, before the closing `}`):

```typescript
  containerName?: string
```

Add to the `CccConfig` interface (after line 150, before the closing `}`):

```typescript
  containers: ContainerConfig[]
  containerSessions: Record<string, string>
```

Modify the `FeaturesConfig` interface (line 111-113) to add the container flag:

```typescript
export interface FeaturesConfig {
  pullRequests: boolean
  containers: boolean
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: Errors in files that reference `FeaturesConfig` or `CccConfig` defaults (will be fixed in subsequent tasks)

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add container session type definitions"
```

---

### Task 2: Add CSS variables for container color

**Files:**
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Add --container variable to dark theme**

In the `:root` / `[data-theme="dark"]` block, add:

```css
  --container: #7ec8c8;
```

- [ ] **Step 2: Add --container variable to light theme**

In the `[data-theme="light"]` block, add:

```css
  --container: #0d7377;
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/index.css
git commit -m "feat(css): add container color variable"
```

---

### Task 3: Update ConfigService defaults and update handler

**Files:**
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Add container fields to DEFAULT_CONFIG**

In `DEFAULT_CONFIG` (line 8-26), add before the closing `}`:

```typescript
  containers: [],
  containerSessions: {},
```

Update the `features` default (line 25):

```typescript
  features: { pullRequests: false, containers: false },
```

- [ ] **Step 2: Add container fields to update() method**

In the `update()` method (after line 132), add:

```typescript
    if (partial.containers !== undefined) this.config.containers = partial.containers
    if (partial.containerSessions !== undefined) this.config.containerSessions = { ...this.config.containerSessions, ...partial.containerSessions }
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: Remaining errors only in renderer (store, settings) — not in main process

- [ ] **Step 4: Commit**

```bash
git add src/main/config-service.ts
git commit -m "feat(config): add container config defaults and update handling"
```

---

### Task 4: Create ContainerService

**Files:**
- Create: `src/main/container-service.ts`

- [ ] **Step 1: Implement ContainerService**

```typescript
import { execSync } from 'child_process'
import type { ContainerConfig } from '../shared/types'
import type { SshService } from './ssh-service'
import type { ConfigService } from './config-service'

interface CacheEntry {
  running: boolean
  expiresAt: number
}

const TTL_MS = 30_000

export class ContainerService {
  private sshService: SshService | null = null
  private configService: ConfigService | null = null
  private cache = new Map<string, CacheEntry>()

  setSshService(sshService: SshService): void {
    this.sshService = sshService
  }

  setConfigService(configService: ConfigService): void {
    this.configService = configService
  }

  isRunning(containerName: string, remoteHost?: string): boolean {
    const cacheKey = `${remoteHost ?? 'local'}:${containerName}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.running
    }

    let running = false
    try {
      if (remoteHost && this.sshService) {
        const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
        const sshHost = hostConfig?.host ?? remoteHost
        const result = this.sshService.exec(sshHost, `docker inspect --format={{.State.Running}} ${containerName}`)
        running = result?.trim() === 'true'
      } else {
        const result = execSync(`docker inspect --format={{.State.Running}} ${containerName}`, {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
        running = result.trim() === 'true'
      }
    } catch {
      running = false
    }

    this.cache.set(cacheKey, { running, expiresAt: Date.now() + TTL_MS })
    return running
  }

  listRunning(remoteHost?: string): ContainerConfig[] {
    const containers = this.configService?.get().containers ?? []
    return containers
      .filter(c => (c.remoteHost ?? undefined) === (remoteHost ?? undefined))
      .filter(c => this.isRunning(c.name, c.remoteHost))
  }

  clearCache(): void {
    this.cache.clear()
  }
}
```

- [ ] **Step 2: Verify typecheck passes for this file**

Run: `pnpm typecheck`
Expected: No errors in container-service.ts

- [ ] **Step 3: Commit**

```bash
git add src/main/container-service.ts
git commit -m "feat: add ContainerService with docker inspect and TTL cache"
```

---

### Task 5: Wire ContainerService into main process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Import and instantiate ContainerService**

Add import (after line 36, with other imports):

```typescript
import { ContainerService } from './container-service'
```

Add instantiation (after line 53, after `prService`):

```typescript
const containerService = new ContainerService()
containerService.setSshService(sshService)
containerService.setConfigService(configService)
```

- [ ] **Step 2: Add container IPC handler**

Add after line 132 (after `registerShellIpc()`):

```typescript
ipcMain.handle('container:list-running', (_event, remoteHost?: string) => {
  return containerService.listRunning(remoteHost)
})
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: wire ContainerService into main process with IPC handler"
```

---

### Task 6: Update SessionManager to support container sessions

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Modify create() to handle containerName**

In the `create()` method (line 244), the `opts` parameter already uses `SessionCreate` which now includes `containerName?`. Modify the method body.

For **remote container sessions** — replace the command-building block (lines 260-267) with container-aware logic:

```typescript
      if (opts.containerName) {
        // Container session: wrap command with docker exec
        const cmd = opts.type === 'claude'
          ? (opts.skipPermissions ?? this.configService?.get().dangerouslySkipPermissions
            ? 'claude --dangerously-skip-permissions' : 'claude')
          : opts.type === 'gemini' ? 'gemini' : ''
        const dockerCmd = `docker exec -it -e CCC_SESSION_NAME=${opts.name} -w ${opts.workingDirectory} ${opts.containerName} zsh -lic '${cmd || 'exec zsh'}'`
        newArgs.push('--', remoteShell, '-ic', dockerCmd)
      } else if (opts.type === 'claude') {
        const skipPerms = opts.skipPermissions ?? this.configService?.get().dangerouslySkipPermissions
        const cmd = skipPerms ? 'claude --dangerously-skip-permissions' : 'claude'
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && ${cmd}`)
      }
      else if (opts.type === 'gemini') {
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && gemini`)
      }
```

For **local container sessions** — replace the command-building block (lines 297-305) with:

```typescript
      if (opts.containerName) {
        const cmd = opts.type === 'claude'
          ? (opts.skipPermissions ?? this.configService?.get().dangerouslySkipPermissions
            ? 'claude --dangerously-skip-permissions' : 'claude')
          : opts.type === 'gemini' ? 'gemini' : ''
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', `docker exec -it -e CCC_SESSION_NAME=${opts.name} -w ${expandedDir} ${opts.containerName} zsh -lic '${cmd || "exec zsh"}'`)
      } else if (opts.type === 'claude') {
        const skipPerms = opts.skipPermissions ?? this.configService?.get().dangerouslySkipPermissions
        const cmd = skipPerms ? 'claude --dangerously-skip-permissions' : 'claude'
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', cmd)
      } else if (opts.type === 'gemini') {
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', 'gemini')
      }
```

- [ ] **Step 2: Add container fields to session object construction**

After line 334 (`remoteHost: opts.remoteHost,`), add:

```typescript
      isContainer: !!opts.containerName,
      containerName: opts.containerName,
```

- [ ] **Step 3: Persist container-session mapping**

After the existing `configService.update()` call (lines 322-325), add:

```typescript
    if (opts.containerName) {
      const containerSessions = { ...this.configService?.get().containerSessions, [opts.name]: opts.containerName }
      this.configService?.update({ containerSessions })
    }
```

- [ ] **Step 4: Set container env vars via docker exec, skip CLAUDE_CONFIG_DIR for containers**

For container sessions, `CLAUDE_CONFIG_DIR` should not be set via tmux (it's inside the container). Wrap the existing `claudeConfigDir` blocks (lines 255-258 and 292-295) with a container check:

Remote (lines 255-258):
```typescript
      if (!opts.containerName) {
        const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
        if (claudeConfigDir) {
          newArgs.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
        }
      }
```

Local (lines 292-295):
```typescript
      if (!opts.containerName) {
        const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
        if (claudeConfigDir) {
          args.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
        }
      }
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS for main process files

- [ ] **Step 6: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "feat(session-manager): wrap tmux commands with docker exec for container sessions"
```

---

### Task 7: Update preload API bridge

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add container IPC to CccAPI**

In the `api` object, add a new `container` section (after the `shell` section):

```typescript
  container: {
    listRunning: (remoteHost?: string): Promise<ContainerConfig[]> =>
      ipcRenderer.invoke('container:list-running', remoteHost)
  },
```

Add the import at the top of the file:

```typescript
import type { ContainerConfig } from '../shared/types'
```

(Or add `ContainerConfig` to the existing types import if one exists.)

- [ ] **Step 2: Add container to CccAPI type definition**

In `src/shared/types.ts`, add to the `CccAPI` interface (after the `shell` section, around line 214):

```typescript
  container: {
    listRunning: (remoteHost?: string) => Promise<ContainerConfig[]>
  }
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/shared/types.ts
git commit -m "feat(preload): expose container IPC bridge"
```

---

### Task 8: Update Zustand store for container state

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add container state and actions to SessionStore interface**

Add to the imports (line 2):

```typescript
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder, AiProvider, RemoteHost, SessionGroup, ActiveView, FeaturesConfig, ContainerConfig } from '../../shared/types'
```

Add state fields to the interface (after line 27, after `features`):

```typescript
  containers: ContainerConfig[]
  enableContainers: boolean
```

Add action to the interface (after `setEnabledProviders`):

```typescript
  setContainers: (containers: ContainerConfig[]) => Promise<void>
  setEnableContainers: (value: boolean) => Promise<void>
```

- [ ] **Step 2: Add defaults and implementations**

Add defaults (after line 90, after `features`):

```typescript
  containers: [],
  enableContainers: false,
```

Add to `loadConfig` (inside the `set()` call, after `features`):

```typescript
      containers: config.containers ?? [],
      enableContainers: config.features?.containers ?? false,
```

Add action implementations (after `setEnabledProviders`):

```typescript
  setContainers: async (containers) => {
    await window.cccAPI.config.update({ containers })
    set({ containers })
  },
  setEnableContainers: async (value) => {
    const features = { ...get().features, containers: value }
    await window.cccAPI.config.update({ features })
    set({ features, enableContainers: value })
  },
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "feat(store): add container state and actions to Zustand store"
```

---

### Task 9: Add container visual indicators to SessionCard

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`

- [ ] **Step 1: Import Box icon**

Add `Box` to the lucide-react import at the top of the file.

- [ ] **Step 2: Add container indicators after remote host badge**

After the remote host badge block (lines 90-95), add:

```typescript
          {session.isContainer && (
            <>
              <span title={`Container: ${session.containerName}`} style={{ color: 'var(--container)' }}>
                <Box size={12} />
              </span>
              {session.containerName && (
                <span className="text-[8px] px-1 py-px rounded font-medium flex-shrink-0"
                  style={{ color: 'var(--container)', backgroundColor: 'color-mix(in srgb, var(--container) 15%, var(--bg-raised))' }}>
                  {session.containerName}
                </span>
              )}
            </>
          )}
```

- [ ] **Step 3: Verify it renders correctly**

Run: `pnpm dev`
Expected: Container sessions show a teal Box icon and container name badge. Non-container sessions unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SessionCard.tsx
git commit -m "feat(ui): add container icon and badge to SessionCard"
```

---

### Task 10: Add container indicator to SessionTopBar

**Files:**
- Modify: `src/renderer/components/SessionTopBar.tsx`

- [ ] **Step 1: Import Box icon**

Add `Box` to the lucide-react import (line 1):

```typescript
import { GitBranch, Folder, Box } from 'lucide-react'
```

- [ ] **Step 2: Add container badge after remote host badge**

After the remote host badge block (lines 46-53), add:

```typescript
      {/* Container badge */}
      {session.isContainer && (
        <div className="flex items-center gap-1">
          <Box size={11} style={{ color: 'var(--container)' }} />
          {session.containerName && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{ color: 'var(--container)', backgroundColor: 'color-mix(in srgb, var(--container) 15%, var(--bg-raised))' }}
            >
              {session.containerName}
            </span>
          )}
        </div>
      )}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SessionTopBar.tsx
git commit -m "feat(ui): add container indicator to SessionTopBar"
```

---

### Task 11: Add container indicator to GridView

**Files:**
- Modify: `src/renderer/components/GridView.tsx`

- [ ] **Step 1: Import Box icon**

Add `Box` to the lucide-react imports at the top of the file.

- [ ] **Step 2: Add Box icon in card header**

After the session name `<span>` (line 125), before the claude status badge (line 126), add:

```typescript
            {session.isContainer && (
              <Box size={10} className="ml-1 flex-shrink-0" style={{ color: 'var(--container)' }} />
            )}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/GridView.tsx
git commit -m "feat(ui): add container icon to GridView card header"
```

---

### Task 12: Add Containers section to SettingsModal

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add 'containers' to Tab type and imports**

Update the Tab type (line 6):

```typescript
type Tab = 'providers' | 'favorites' | 'appearance' | 'remotes' | 'worktrees' | 'advanced' | 'features' | 'containers'
```

Add `Box` to the lucide-react imports (line 2):

```typescript
import { X, Plus, Trash2, Pencil, Check, RotateCcw, Server, ChevronDown, ChevronRight, Box } from 'lucide-react'
```

Add `ContainerConfig` to the types import (line 4):

```typescript
import type { FavoriteFolder, AiProvider, RemoteHost, ClaudeConfigRoute, ContainerConfig } from '../../shared/types'
```

- [ ] **Step 2: Add container state from store**

After the existing store hooks (around line 41), add:

```typescript
  const containers = useSessionStore((s) => s.containers)
  const setContainers = useSessionStore((s) => s.setContainers)
  const enableContainers = useSessionStore((s) => s.enableContainers)
  const setEnableContainers = useSessionStore((s) => s.setEnableContainers)
```

Add local state for container editing (after the remote hosts state, around line 50):

```typescript
  const [addContainerMode, setAddContainerMode] = useState(false)
  const [newContainer, setNewContainer] = useState<ContainerConfig>({ name: '' })
  const [editContainerIdx, setEditContainerIdx] = useState<number | null>(null)
```

- [ ] **Step 3: Add containers tab button**

In the tab list (find the `features` tab button), add a containers tab button right before it:

```typescript
            <button
              className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${tab === 'containers' ? 'font-semibold' : ''}`}
              style={{
                color: tab === 'containers' ? 'var(--accent)' : 'var(--text-muted)',
                backgroundColor: tab === 'containers' ? 'rgba(233,200,128,0.1)' : 'transparent'
              }}
              onClick={() => setTab('containers')}
            >
              Containers
            </button>
```

- [ ] **Step 4: Add containers tab content**

Add a new tab content block (before the closing of the tab content area, following the pattern of other tabs):

```typescript
          {tab === 'containers' && (
            <div className="space-y-4">
              {/* Feature flag toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableContainers}
                  onChange={(e) => void setEnableContainers(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  Enable container sessions
                </span>
              </label>

              {enableContainers && (
                <>
                  {/* Container list */}
                  {containers.map((container, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 rounded"
                      style={{ backgroundColor: 'var(--bg-primary)' }}
                    >
                      <Box size={12} style={{ color: 'var(--container)' }} />
                      {editContainerIdx === idx ? (
                        <>
                          <input
                            className="flex-1 text-[11px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                            value={containers[idx].label ?? containers[idx].name}
                            onChange={(e) => {
                              const updated = [...containers]
                              updated[idx] = { ...updated[idx], label: e.target.value || undefined }
                              void setContainers(updated)
                            }}
                            placeholder="Label"
                          />
                          <button onClick={() => setEditContainerIdx(null)}>
                            <Check size={12} style={{ color: 'var(--success)' }} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                            {container.label || container.name}
                          </span>
                          <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
                            {container.name}
                          </span>
                          {container.remoteHost && (
                            <span className="text-[9px] px-1 py-px rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
                              @{container.remoteHost}
                            </span>
                          )}
                          <button onClick={() => setEditContainerIdx(idx)}>
                            <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
                          </button>
                          <button onClick={() => {
                            void setContainers(containers.filter((_, i) => i !== idx))
                          }}>
                            <Trash2 size={12} style={{ color: 'var(--error)' }} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add container form */}
                  {addContainerMode ? (
                    <div className="space-y-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
                      <input
                        className="w-full text-[11px] px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                        placeholder="Container name (required)"
                        value={newContainer.name}
                        onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                        autoFocus
                      />
                      <input
                        className="w-full text-[11px] px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                        placeholder="Label (optional)"
                        value={newContainer.label ?? ''}
                        onChange={(e) => setNewContainer({ ...newContainer, label: e.target.value || undefined })}
                      />
                      <select
                        className="w-full text-[11px] px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                        value={newContainer.remoteHost ?? ''}
                        onChange={(e) => setNewContainer({ ...newContainer, remoteHost: e.target.value || undefined })}
                      >
                        <option value="">Local</option>
                        {remoteHosts.map(h => (
                          <option key={h.name} value={h.name}>{h.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          className="text-[11px] px-2 py-1 rounded font-medium"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                          onClick={() => {
                            if (newContainer.name.trim()) {
                              void setContainers([...containers, { ...newContainer, name: newContainer.name.trim() }])
                              setNewContainer({ name: '' })
                              setAddContainerMode(false)
                            }
                          }}
                        >
                          Add
                        </button>
                        <button
                          className="text-[11px] px-2 py-1 rounded"
                          style={{ color: 'var(--text-muted)' }}
                          onClick={() => { setAddContainerMode(false); setNewContainer({ name: '' }) }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded"
                      style={{ color: 'var(--accent)' }}
                      onClick={() => setAddContainerMode(true)}
                    >
                      <Plus size={12} /> Add container
                    </button>
                  )}
                </>
              )}
            </div>
          )}
```

- [ ] **Step 5: Verify it renders correctly**

Run: `pnpm dev`
Expected: New "Containers" tab in settings with feature toggle and container CRUD

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat(settings): add Containers tab with feature flag and CRUD"
```

---

### Task 13: Add container selection to session creation dialog

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx` (or wherever the session creation modal/dialog lives)

- [ ] **Step 1: Find the session creation UI**

The session creation is triggered by `toggleModal()` which opens a modal. Read the component that handles session creation to understand the current flow. It's likely in `SessionSidebar.tsx` or a dedicated `CreateSessionModal.tsx`.

- [ ] **Step 2: Add container selection state**

Add state and store hooks:

```typescript
const enableContainers = useSessionStore((s) => s.enableContainers)
const [runningContainers, setRunningContainers] = useState<ContainerConfig[]>([])
const [selectedContainer, setSelectedContainer] = useState<string | undefined>(undefined)
```

- [ ] **Step 3: Fetch running containers when dialog opens**

When the creation dialog opens, if `enableContainers` is true, fetch running containers for the selected remote host:

```typescript
useEffect(() => {
  if (!enableContainers) return
  void window.cccAPI.container.listRunning(selectedRemoteHost).then(containers => {
    setRunningContainers(containers)
    // Default to first running container (feature flag ON = container pre-selected)
    if (containers.length > 0) {
      setSelectedContainer(containers[0].name)
    }
  })
}, [enableContainers, selectedRemoteHost])
```

- [ ] **Step 4: Add container selection UI**

After the working directory / repo selection, before the create button, add:

```typescript
{enableContainers && runningContainers.length > 0 && (
  <div className="space-y-1">
    <label className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Container</label>
    <select
      className="w-full text-[11px] px-2 py-1 rounded"
      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      value={selectedContainer ?? ''}
      onChange={(e) => setSelectedContainer(e.target.value || undefined)}
    >
      <option value="">Run locally</option>
      {runningContainers.map(c => (
        <option key={c.name} value={c.name}>{c.label || c.name}</option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 5: Pass containerName to createSession**

In the create button handler, pass the selected container:

```typescript
await createSession({
  name,
  workingDirectory,
  type,
  remoteHost: selectedRemoteHost,
  containerName: selectedContainer,
  // ... other fields
})
```

- [ ] **Step 6: Verify the full flow works**

Run: `pnpm dev`
Expected: With feature flag on and a container configured + running, the creation dialog shows container selection pre-selected. Creating a session wraps with docker exec.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "feat(ui): add container selection to session creation dialog"
```

---

### Task 14: Restore container state on session list reload

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Restore isContainer and containerName when listing sessions**

In the `list()` method, when building Session objects from tmux output, check `containerSessions` config to restore container state:

```typescript
const containerSessions = this.configService?.get().containerSessions ?? {}
// For each session, after building the object:
const containerName = containerSessions[session.name]
if (containerName) {
  session.isContainer = true
  session.containerName = containerName
}
```

Find the exact location in `list()` where Session objects are constructed and add these fields.

- [ ] **Step 2: Verify sessions survive reload**

Run: `pnpm dev`
Expected: Container sessions still show the container icon and badge after reloading the session list

- [ ] **Step 3: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "feat(session-manager): restore container state from config on list"
```

---

### Task 15: Clean up container-session mapping on session kill

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Remove containerSessions entry when session is killed**

In the `kill()` method, after removing the session, clean up the mapping:

```typescript
const config = this.configService?.get()
if (config?.containerSessions?.[session.name]) {
  const containerSessions = { ...config.containerSessions }
  delete containerSessions[session.name]
  this.configService?.update({ containerSessions })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "feat(session-manager): clean up container mapping on session kill"
```

---

### Task 16: Final integration verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: PASS with zero errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS (fix any lint issues)

- [ ] **Step 3: Manual end-to-end test**

1. Open settings → Containers tab
2. Toggle "Enable container sessions" ON
3. Add a container (name: an actual running Docker container)
4. Create a new session → verify container is pre-selected
5. Create the session → verify `docker exec` wraps the command (check tmux)
6. Verify SessionCard shows Box icon + container name badge in teal
7. Verify SessionTopBar shows the same
8. Switch to grid view → verify Box icon in card header
9. Kill the session → verify cleanup
10. Toggle feature flag OFF → verify no container UI visible

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from container sessions testing"
```
