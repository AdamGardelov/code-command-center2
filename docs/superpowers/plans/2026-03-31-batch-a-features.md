# Batch A Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude config routing, skip permissions, session exclusion, and IDE integration to CCC2.

**Architecture:** All four features share a vertical slice pattern: types → config → backend → IPC → preload → store → UI. They share a new "Advanced" Settings tab. Each feature is independent and can be built in parallel after the shared type/config foundation (Task 1).

**Tech Stack:** TypeScript, Electron IPC, Zustand, React, Tailwind CSS, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-31-batch-a-features-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types.ts` | Modify | Add ClaudeConfigRoute, new CccConfig fields, new Session fields, new CccAPI methods |
| `src/main/config-service.ts` | Modify | Add new config fields, defaults, load/update logic, resolveClaudeConfigDir(), toggleExcluded() |
| `src/main/session-manager.ts` | Modify | Use config routing + skip permissions in create(), add openInIde() |
| `src/main/ipc/config.ts` | Modify | Add config:toggle-excluded handler |
| `src/main/ipc/session.ts` | Modify | Add session:open-ide handler |
| `src/preload/index.ts` | Modify | Expose toggleExcluded and openInIde |
| `src/renderer/stores/session-store.ts` | Modify | Add exclusion state, toggleExcluded action, ideCommand state |
| `src/renderer/components/SettingsModal.tsx` | Modify | Add "Advanced" tab with IDE command, skip permissions toggle, config routing UI |
| `src/renderer/components/SessionCard.tsx` | Modify | Show skip permissions indicator, excluded styling, context menu items |
| `src/renderer/components/GroupContextMenu.tsx` | Modify | Add "Exclude/Include" and "Open in IDE" options |
| `src/renderer/components/SessionSidebar.tsx` | Modify | Show excluded count in header |

---

### Task 1: Types and Config Foundation

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Add new types to `src/shared/types.ts`**

Add after the `SessionGroup` interface (after line 50):

```typescript
export interface ClaudeConfigRoute {
  pathPrefix: string
  configDir: string
}
```

Add new fields to the `Session` interface (after line 18, before the closing `}`):

```typescript
  skipPermissions?: boolean
  isExcluded?: boolean
```

Add new fields to the `CccConfig` interface (after line 68, before the closing `}`):

```typescript
  dangerouslySkipPermissions: boolean
  excludedSessions: string[]
  ideCommand?: string
  claudeConfigRoutes: ClaudeConfigRoute[]
  defaultClaudeConfigDir?: string
```

Add new methods to `CccAPI.session` (after line 82, before the closing `}`):

```typescript
    openInIde: (id: string) => Promise<void>
```

Add new method to `CccAPI.config` (after line 94, before the closing `}`):

```typescript
    toggleExcluded: (sessionName: string) => Promise<void>
```

- [ ] **Step 2: Update config defaults in `src/main/config-service.ts`**

Add to `DEFAULT_CONFIG` (after line 17, before the closing `}`):

```typescript
  dangerouslySkipPermissions: false,
  excludedSessions: [],
  claudeConfigRoutes: []
```

- [ ] **Step 3: Update `load()` in `src/main/config-service.ts`**

Add to the `this.config = { ... }` block inside `load()` (after line 44, before the closing `}`):

```typescript
          dangerouslySkipPermissions: parsed.dangerouslySkipPermissions === true,
          excludedSessions: Array.isArray(parsed.excludedSessions) ? parsed.excludedSessions : [],
          ideCommand: typeof parsed.ideCommand === 'string' ? parsed.ideCommand : undefined,
          claudeConfigRoutes: Array.isArray(parsed.claudeConfigRoutes) ? parsed.claudeConfigRoutes : [],
          defaultClaudeConfigDir: typeof parsed.defaultClaudeConfigDir === 'string' ? parsed.defaultClaudeConfigDir : undefined
```

- [ ] **Step 4: Update `update()` in `src/main/config-service.ts`**

Add to the `update()` method (after line 81, before `this.save(this.config)`):

```typescript
    if (partial.dangerouslySkipPermissions !== undefined) this.config.dangerouslySkipPermissions = partial.dangerouslySkipPermissions
    if (partial.excludedSessions !== undefined) this.config.excludedSessions = partial.excludedSessions
    if (partial.ideCommand !== undefined) this.config.ideCommand = partial.ideCommand
    if (partial.claudeConfigRoutes !== undefined) this.config.claudeConfigRoutes = partial.claudeConfigRoutes
    if (partial.defaultClaudeConfigDir !== undefined) this.config.defaultClaudeConfigDir = partial.defaultClaudeConfigDir
```

- [ ] **Step 5: Add `resolveClaudeConfigDir()` and `toggleExcluded()` to ConfigService**

Add before the `get()` method (before line 87):

```typescript
  resolveClaudeConfigDir(workingDirectory: string): string | undefined {
    const expanded = workingDirectory.replace(/^~/, process.env.HOME ?? '')
    for (const route of this.config.claudeConfigRoutes) {
      const prefix = route.pathPrefix.replace(/^~/, process.env.HOME ?? '')
      if (expanded.startsWith(prefix)) {
        return route.configDir.replace(/^~/, process.env.HOME ?? '')
      }
    }
    if (this.config.defaultClaudeConfigDir) {
      return this.config.defaultClaudeConfigDir.replace(/^~/, process.env.HOME ?? '')
    }
    return undefined
  }

  toggleExcluded(sessionName: string): void {
    const idx = this.config.excludedSessions.indexOf(sessionName)
    if (idx >= 0) {
      this.config.excludedSessions.splice(idx, 1)
    } else {
      this.config.excludedSessions.push(sessionName)
    }
    this.save(this.config)
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/config-service.ts
git commit -m "Add types and config for batch A features (config routing, skip perms, exclusion, IDE)"
```

---

### Task 2: Backend — Session Manager Changes

**Files:**
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Add `child_process` import at top of `src/main/session-manager.ts`**

Add after existing imports (line 1 area):

```typescript
import { spawn } from 'child_process'
```

- [ ] **Step 2: Modify local session creation to support config routing and skip permissions**

In `create()`, the local session block (lines 263-292), replace the command construction. After line 274 (`CCC_SESSION_NAME=${opts.name}`), before the type check (line 276), add env var for config routing:

```typescript
      const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
      if (claudeConfigDir) {
        args.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
      }
```

Then modify the claude type check (line 276-278). Replace:

```typescript
      if (opts.type === 'claude') {
        args.push('--', 'claude')
      } else if (opts.type === 'gemini') {
```

With:

```typescript
      if (opts.type === 'claude') {
        const skipPerms = this.configService?.get().dangerouslySkipPermissions
        if (skipPerms) {
          args.push('--', 'claude', '--dangerously-skip-permissions')
        } else {
          args.push('--', 'claude')
        }
      } else if (opts.type === 'gemini') {
```

- [ ] **Step 3: Modify remote session creation similarly**

In `create()`, the remote session block (lines 249-262). After line 251 (the `-e CCC_SESSION_NAME` push), add:

```typescript
      const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
      if (claudeConfigDir) {
        newArgs.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
      }
```

Replace the remote claude type check (line 252):

```typescript
      if (opts.type === 'claude') newArgs.push('--', 'claude')
```

With:

```typescript
      if (opts.type === 'claude') {
        const skipPerms = this.configService?.get().dangerouslySkipPermissions
        if (skipPerms) {
          newArgs.push('--', 'claude', '--dangerously-skip-permissions')
        } else {
          newArgs.push('--', 'claude')
        }
      }
```

- [ ] **Step 4: Set `skipPermissions` on the session object**

In the session object construction (line 300-312), add after `remoteHost: opts.remoteHost,` (line 307):

```typescript
      skipPermissions: this.configService?.get().dangerouslySkipPermissions && opts.type === 'claude' ? true : undefined,
```

- [ ] **Step 5: Add `openInIde()` method**

Add after the `getSessionInfo()` method (after line 356):

```typescript
  openInIde(id: string): void {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)
    if (session.remoteHost) throw new Error('IDE integration not supported for remote sessions')

    const ideCommand = this.configService?.get().ideCommand
    if (!ideCommand) throw new Error('IDE command not configured. Set it in Settings > Advanced.')

    const dir = session.workingDirectory.replace(/^~/, process.env.HOME ?? '')
    const child = spawn(ideCommand, [dir], { detached: true, stdio: 'ignore' })
    child.unref()
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/main/session-manager.ts
git commit -m "Add config routing, skip permissions, and IDE launch to SessionManager"
```

---

### Task 3: IPC and Preload

**Files:**
- Modify: `src/main/ipc/config.ts`
- Modify: `src/main/ipc/session.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add toggle-excluded IPC handler in `src/main/ipc/config.ts`**

Add after the existing `config:update` handler:

```typescript
  ipcMain.handle('config:toggle-excluded', (_event, sessionName: string) => {
    configService.toggleExcluded(sessionName)
  })
```

- [ ] **Step 2: Add open-ide IPC handler in `src/main/ipc/session.ts`**

Add after the existing `session:kill` handler:

```typescript
  ipcMain.handle('session:open-ide', async (_event, id: string) => {
    sessionManager.openInIde(id)
  })
```

- [ ] **Step 3: Update preload `src/preload/index.ts`**

Add `openInIde` to the session namespace (after the `detach` method, line 15):

```typescript
    openInIde: (id: string): Promise<void> => ipcRenderer.invoke('session:open-ide', id),
```

Add `toggleExcluded` to the config namespace (after the `update` method, line 49):

```typescript
    toggleExcluded: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-excluded', sessionName),
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/config.ts src/main/ipc/session.ts src/preload/index.ts
git commit -m "Add IPC handlers and preload bridge for exclusion and IDE integration"
```

---

### Task 4: Store — Exclusion and IDE State

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add new state fields**

Add to the store state interface (alongside `worktreeBasePath`):

```typescript
  excludedSessions: string[]
  dangerouslySkipPermissions: boolean
  ideCommand: string
```

Add to the initial state in the `create()` call:

```typescript
  excludedSessions: [],
  dangerouslySkipPermissions: false,
  ideCommand: '',
```

- [ ] **Step 2: Update `loadConfig()` to load new fields**

In `loadConfig()`, add after the existing config field assignments:

```typescript
      excludedSessions: config.excludedSessions ?? [],
      dangerouslySkipPermissions: config.dangerouslySkipPermissions ?? false,
      ideCommand: config.ideCommand ?? '',
```

- [ ] **Step 3: Update `loadSessions()` to mark excluded sessions**

In `loadSessions()`, after fetching sessions from IPC, add exclusion marking before setting state:

```typescript
      const excluded = get().excludedSessions
      const marked = sessions.map((s: Session) => ({
        ...s,
        isExcluded: excluded.includes(s.name)
      }))
```

Then use `marked` instead of `sessions` when setting state.

- [ ] **Step 4: Add new actions**

Add after the existing `removeSessionFromGroup` action:

```typescript
    toggleExcluded: async (sessionId: string) => {
      const session = get().sessions.find(s => s.id === sessionId)
      if (!session) return
      await window.cccAPI.config.toggleExcluded(session.name)
      set({
        sessions: get().sessions.map(s =>
          s.id === sessionId ? { ...s, isExcluded: !s.isExcluded } : s
        ),
        excludedSessions: get().sessions.find(s => s.id === sessionId)?.isExcluded
          ? get().excludedSessions.filter(n => n !== session.name)
          : [...get().excludedSessions, session.name]
      })
    },

    setDangerouslySkipPermissions: async (value: boolean) => {
      await window.cccAPI.config.update({ dangerouslySkipPermissions: value })
      set({ dangerouslySkipPermissions: value })
    },

    setIdeCommand: async (value: string) => {
      await window.cccAPI.config.update({ ideCommand: value || undefined })
      set({ ideCommand: value })
    },

    openInIde: async (sessionId: string) => {
      await window.cccAPI.session.openInIde(sessionId)
    },
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "Add exclusion, skip permissions, and IDE state to session store"
```

---

### Task 5: UI — SessionCard and Context Menu

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`
- Modify: `src/renderer/components/GroupContextMenu.tsx`

- [ ] **Step 1: Add skip permissions indicator to SessionCard**

Import `Zap` from lucide-react at the top of `SessionCard.tsx`.

In the first row of SessionCard (around line 82-118), after the remote host badge and before the status dot, add:

```tsx
{session.skipPermissions && (
  <span title="Skip Permissions enabled" style={{ color: 'var(--warning, #f59e0b)' }}>
    <Zap size={12} />
  </span>
)}
```

- [ ] **Step 2: Add excluded styling to SessionCard**

Wrap the outermost div's style to apply opacity when excluded. On the main container div (around line 55), add to the existing style object:

```tsx
opacity: session.isExcluded ? 0.4 : 1,
```

- [ ] **Step 3: Add "Exclude/Include" and "Open in IDE" to GroupContextMenu**

Import `useSessionStore` at the top of `GroupContextMenu.tsx` if not already imported.

Add store actions inside the component:

```tsx
const toggleExcluded = useSessionStore(s => s.toggleExcluded)
const openInIde = useSessionStore(s => s.openInIde)
const ideCommand = useSessionStore(s => s.ideCommand)
const session = useSessionStore(s => s.sessions.find(sess => sess.id === sessionId))
```

Add before the "New group..." button (before line 80, the divider):

```tsx
<div style={{ height: 1, background: 'var(--border)' }} />
<button
  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
  onClick={() => { toggleExcluded(sessionId); onClose() }}
>
  {session?.isExcluded ? 'Include session' : 'Exclude session'}
</button>
{ideCommand && !session?.remoteHost && (
  <button
    className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
    onClick={() => { openInIde(sessionId); onClose() }}
  >
    Open in IDE
  </button>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SessionCard.tsx src/renderer/components/GroupContextMenu.tsx
git commit -m "Add skip permissions indicator, exclusion styling, and context menu actions"
```

---

### Task 6: UI — Sidebar Excluded Count and Grid Filtering

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Add excluded count to sidebar header**

In `SessionSidebar`, derive the excluded count from sessions:

```tsx
const excludedCount = sessions.filter(s => s.isExcluded).length
```

In the header area (around line 269-296), after the running session count or near the header text, add:

```tsx
{excludedCount > 0 && (
  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
    {' '}· {excludedCount} excluded
  </span>
)}
```

- [ ] **Step 2: Filter excluded sessions from grid view**

Find where sessions are passed to grid mode rendering. In the main app component or wherever grid mode renders, filter out excluded sessions:

```tsx
const gridSessions = sessions.filter(s => !s.isExcluded)
```

Use `gridSessions` instead of `sessions` for grid rendering.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "Show excluded count in sidebar and filter excluded from grid view"
```

Note: If grid filtering happens in a different component (e.g., `TerminalGrid.tsx` or the main `App.tsx`), modify that file instead. Search for the grid rendering logic and apply the filter there.

---

### Task 7: UI — Settings Advanced Tab

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add 'advanced' to the tab type and tab bar**

In `SettingsModal.tsx`, find the tab type definition and tab buttons. Add `'advanced'` as a new tab option.

Update the tabs array/buttons section to include:

```tsx
<button
  className={`px-3 py-1.5 text-sm rounded ${tab === 'advanced' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
  onClick={() => setTab('advanced')}
>
  Advanced
</button>
```

- [ ] **Step 2: Add state for config routing editing**

Add state variables in the component:

```tsx
const [editRouteIdx, setEditRouteIdx] = useState<number | null>(null)
const [editRouteForm, setEditRouteForm] = useState({ pathPrefix: '', configDir: '' })
const [addRouteMode, setAddRouteMode] = useState(false)
```

Get store values:

```tsx
const dangerouslySkipPermissions = useSessionStore(s => s.dangerouslySkipPermissions)
const setDangerouslySkipPermissions = useSessionStore(s => s.setDangerouslySkipPermissions)
const ideCommand = useSessionStore(s => s.ideCommand)
const setIdeCommand = useSessionStore(s => s.setIdeCommand)
```

- [ ] **Step 3: Add the Advanced tab content**

Add the tab content inside the tab rendering switch. This goes alongside the existing tab content blocks:

```tsx
{tab === 'advanced' && (
  <div className="space-y-6">
    {/* IDE Command */}
    <div>
      <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>IDE Command</h3>
      <input
        className="w-full px-3 py-2 rounded text-sm"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        placeholder="code"
        value={ideCommand}
        onChange={(e) => setIdeCommand(e.target.value)}
      />
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        Command to open working directory in your editor (e.g. code, cursor, rider)
      </p>
    </div>

    {/* Skip Permissions */}
    <div>
      <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Skip Permissions</h3>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={dangerouslySkipPermissions}
          onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
          Pass --dangerously-skip-permissions to new Claude sessions
        </span>
      </label>
      <p className="text-xs mt-1" style={{ color: 'var(--warning, #f59e0b)' }}>
        Warning: This allows Claude to execute commands without confirmation
      </p>
    </div>

    {/* Claude Config Routing */}
    <div>
      <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Claude Config Routing</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Route sessions to different Claude configurations based on working directory
      </p>

      {/* Default config dir */}
      <div className="mb-3">
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Default Config Dir</label>
        <input
          className="w-full px-3 py-2 rounded text-sm"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          placeholder="~/.claude (leave empty for default)"
          value={defaultClaudeConfigDir}
          onChange={(e) => {
            const val = e.target.value
            setDefaultClaudeConfigDir(val)
            window.cccAPI.config.update({ defaultClaudeConfigDir: val || undefined })
          }}
        />
      </div>

      {/* Route list */}
      {claudeConfigRoutes.map((route, i) => (
        editRouteIdx === i ? (
          <div key={i} className="flex gap-2 mb-2">
            <input
              className="flex-1 px-2 py-1 rounded text-sm"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="Path prefix (~/Dev/Project)"
              value={editRouteForm.pathPrefix}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
            />
            <input
              className="flex-1 px-2 py-1 rounded text-sm"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              placeholder="Config dir (~/.claude-project)"
              value={editRouteForm.configDir}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
            />
            <button
              className="px-2 py-1 rounded text-sm"
              style={{ background: 'var(--accent)', color: 'white' }}
              onClick={() => {
                const updated = [...claudeConfigRoutes]
                updated[i] = editRouteForm
                setClaudeConfigRoutes(updated)
                window.cccAPI.config.update({ claudeConfigRoutes: updated })
                setEditRouteIdx(null)
              }}
            >Save</button>
            <button
              className="px-2 py-1 rounded text-sm"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => setEditRouteIdx(null)}
            >Cancel</button>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
            <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{route.pathPrefix}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
            <span className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{route.configDir}</span>
            <button
              className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => { setEditRouteIdx(i); setEditRouteForm(route) }}
            >Edit</button>
            <button
              className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--error)' }}
              onClick={() => {
                const updated = claudeConfigRoutes.filter((_, j) => j !== i)
                setClaudeConfigRoutes(updated)
                window.cccAPI.config.update({ claudeConfigRoutes: updated })
              }}
            >Delete</button>
          </div>
        )
      ))}

      {addRouteMode ? (
        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            placeholder="Path prefix (~/Dev/Project)"
            value={editRouteForm.pathPrefix}
            onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
          />
          <input
            className="flex-1 px-2 py-1 rounded text-sm"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            placeholder="Config dir (~/.claude-project)"
            value={editRouteForm.configDir}
            onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
          />
          <button
            className="px-2 py-1 rounded text-sm"
            style={{ background: 'var(--accent)', color: 'white' }}
            onClick={() => {
              if (editRouteForm.pathPrefix && editRouteForm.configDir) {
                const updated = [...claudeConfigRoutes, editRouteForm]
                setClaudeConfigRoutes(updated)
                window.cccAPI.config.update({ claudeConfigRoutes: updated })
                setAddRouteMode(false)
                setEditRouteForm({ pathPrefix: '', configDir: '' })
              }
            }}
          >Add</button>
          <button
            className="px-2 py-1 rounded text-sm"
            style={{ color: 'var(--text-muted)' }}
            onClick={() => { setAddRouteMode(false); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
          >Cancel</button>
        </div>
      ) : (
        <button
          className="text-sm px-3 py-1.5 rounded"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
          onClick={() => { setAddRouteMode(true); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
        >
          + Add route
        </button>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Add local state for config routing data**

Add state variables for the route data and default config dir:

```tsx
const [claudeConfigRoutes, setClaudeConfigRoutes] = useState<ClaudeConfigRoute[]>([])
const [defaultClaudeConfigDir, setDefaultClaudeConfigDir] = useState('')
```

Load them when the settings modal opens (in a useEffect or alongside loadConfig):

```tsx
useEffect(() => {
  if (settingsOpen) {
    window.cccAPI.config.load().then((config) => {
      setClaudeConfigRoutes(config.claudeConfigRoutes ?? [])
      setDefaultClaudeConfigDir(config.defaultClaudeConfigDir ?? '')
    })
  }
}, [settingsOpen])
```

Import `ClaudeConfigRoute` from `../../shared/types` at the top.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "Add Advanced settings tab with IDE command, skip permissions, and config routing"
```

---

### Task 8: Integration Verification

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors. If there are type errors, fix them — likely missing imports or mismatched type names.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 3: Manual smoke test**

Start the app with `npm run dev` and verify:
1. Settings > Advanced tab appears with IDE command, skip permissions toggle, and config routing
2. Set IDE command to "code", right-click a session → "Open in IDE" works
3. Toggle skip permissions ON, create a new Claude session → verify `--dangerously-skip-permissions` is in the tmux command (`tmux capture-pane -t ccc-<name> -p`)
4. Right-click a session → "Exclude session" → card dims, grid hides it, sidebar shows "· 1 excluded"
5. Right-click excluded session → "Include session" → restored
6. Add a config route in Advanced, create a session in that path → verify CLAUDE_CONFIG_DIR is set

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "Fix integration issues from batch A features"
```
