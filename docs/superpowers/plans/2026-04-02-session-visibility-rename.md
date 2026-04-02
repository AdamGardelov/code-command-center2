# Session Visibility & Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session archiving, clearer exclude-from-grid labeling, and display name rename to CCC2.

**Architecture:** Three layers of changes — shared types + config service (backend), preload/IPC bridge, then store + UI components (frontend). Each task produces a working commit.

**Tech Stack:** TypeScript, Electron IPC, Zustand, React, Tailwind CSS

---

### Task 1: Add Types and Config Defaults

**Files:**
- Modify: `src/shared/types.ts:7-23` (Session interface)
- Modify: `src/shared/types.ts:151-176` (CccConfig interface)
- Modify: `src/shared/types.ts:178-248` (CccAPI interface)

- [ ] **Step 1: Add `isArchived` and `displayName` to Session interface**

In `src/shared/types.ts`, add two fields to the `Session` interface after `isExcluded`:

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
  repoPath?: string
  createdAt: number
  lastActiveAt: number
  skipPermissions?: boolean
  isExcluded?: boolean
  isArchived?: boolean
  displayName?: string
  isContainer?: boolean
  containerName?: string
}
```

- [ ] **Step 2: Add `archivedSessions` and `sessionDisplayNames` to CccConfig**

In `src/shared/types.ts`, add two fields to `CccConfig` after `excludedSessions`:

```typescript
  excludedSessions: string[]
  archivedSessions: string[]
  sessionDisplayNames: Record<string, string>
```

- [ ] **Step 3: Add `toggleArchived` and `setDisplayName` to CccAPI config section**

In `src/shared/types.ts`, add to the `config` section of `CccAPI`:

```typescript
  config: {
    load: () => Promise<CccConfig>
    update: (partial: Partial<CccConfig>) => Promise<CccConfig>
    toggleExcluded: (sessionName: string) => Promise<void>
    toggleMuted: (sessionName: string) => Promise<void>
    toggleArchived: (sessionName: string) => Promise<void>
    setDisplayName: (sessionName: string, displayName: string) => Promise<void>
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add archive and display name types to Session and CccConfig"
```

---

### Task 2: Config Service — Archive and Display Name Methods

**Files:**
- Modify: `src/main/config-service.ts:8-30` (DEFAULT_CONFIG)
- Modify: `src/main/config-service.ts:35-101` (load method, parsing)
- Modify: `src/main/config-service.ts:116-148` (update method)
- Modify: `src/main/config-service.ts:174-182` (after toggleExcluded)

- [ ] **Step 1: Add defaults for new config fields**

In `src/main/config-service.ts`, add to `DEFAULT_CONFIG` after `excludedSessions`:

```typescript
  excludedSessions: [],
  archivedSessions: [],
  sessionDisplayNames: {},
```

- [ ] **Step 2: Parse new fields in `load()` method**

In the `load()` method, add parsing after the `excludedSessions` line (line 60):

```typescript
          excludedSessions: Array.isArray(parsed.excludedSessions) ? parsed.excludedSessions : [],
          archivedSessions: Array.isArray(parsed.archivedSessions) ? parsed.archivedSessions : [],
          sessionDisplayNames: parsed.sessionDisplayNames && typeof parsed.sessionDisplayNames === 'object'
            ? parsed.sessionDisplayNames
            : {},
```

- [ ] **Step 3: Handle new fields in `update()` method**

In the `update()` method, add after the `excludedSessions` line (line 133):

```typescript
    if (partial.excludedSessions !== undefined) this.config.excludedSessions = partial.excludedSessions
    if (partial.archivedSessions !== undefined) this.config.archivedSessions = partial.archivedSessions
    if (partial.sessionDisplayNames !== undefined) this.config.sessionDisplayNames = { ...this.config.sessionDisplayNames, ...partial.sessionDisplayNames }
```

- [ ] **Step 4: Add `toggleArchived()` and `setDisplayName()` methods**

Add after the existing `toggleExcluded()` method (after line 182):

```typescript
  toggleArchived(sessionName: string): void {
    const idx = this.config.archivedSessions.indexOf(sessionName)
    if (idx >= 0) {
      // Unarchiving — just remove from archived
      this.config.archivedSessions.splice(idx, 1)
    } else {
      // Archiving — add to archived, remove from excluded (archive supersedes)
      this.config.archivedSessions.push(sessionName)
      const exIdx = this.config.excludedSessions.indexOf(sessionName)
      if (exIdx >= 0) {
        this.config.excludedSessions.splice(exIdx, 1)
      }
    }
    this.save(this.config)
  }

  setDisplayName(sessionName: string, displayName: string): void {
    if (displayName.trim() === '') {
      delete this.config.sessionDisplayNames[sessionName]
    } else {
      this.config.sessionDisplayNames[sessionName] = displayName.trim()
    }
    this.save(this.config)
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/main/config-service.ts
git commit -m "feat: add toggleArchived and setDisplayName to ConfigService"
```

---

### Task 3: IPC Handlers and Preload Bridge

**Files:**
- Modify: `src/main/ipc/config.ts:1-21`
- Modify: `src/preload/index.ts:50-55` (config section)

- [ ] **Step 1: Add IPC handlers**

In `src/main/ipc/config.ts`, add two new handlers after the `config:toggle-muted` handler:

```typescript
  ipcMain.handle('config:toggle-archived', (_event, sessionName: string) => {
    configService.toggleArchived(sessionName)
  })

  ipcMain.handle('config:set-display-name', (_event, sessionName: string, displayName: string) => {
    configService.setDisplayName(sessionName, displayName)
  })
```

- [ ] **Step 2: Add preload API methods**

In `src/preload/index.ts`, add to the `config` object after `toggleMuted`:

```typescript
  config: {
    load: (): Promise<CccConfig> => ipcRenderer.invoke('config:load'),
    update: (partial: Partial<CccConfig>): Promise<CccConfig> => ipcRenderer.invoke('config:update', partial),
    toggleExcluded: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-excluded', sessionName),
    toggleMuted: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-muted', sessionName),
    toggleArchived: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-archived', sessionName),
    setDisplayName: (sessionName: string, displayName: string): Promise<void> => ipcRenderer.invoke('config:set-display-name', sessionName, displayName)
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/config.ts src/preload/index.ts
git commit -m "feat: add IPC handlers and preload bridge for archive and display name"
```

---

### Task 4: Zustand Store — Archive and Display Name Actions

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add `archivedSessions` to store interface and state**

In the `SessionStore` interface (around line 22), add after `excludedSessions`:

```typescript
  archivedSessions: string[]
```

Add new actions to the interface (around line 46), after `toggleMuted`:

```typescript
  toggleArchived: (sessionId: string) => Promise<void>
  setDisplayName: (sessionId: string, displayName: string) => Promise<void>
  renamingSessionId: string | null
  setRenamingSessionId: (id: string | null) => void
```

In the initial state (around line 96), add after `excludedSessions: []`:

```typescript
  archivedSessions: [],
  renamingSessionId: null,
```

- [ ] **Step 2: Load `archivedSessions` and `sessionDisplayNames` in `loadConfig`**

In the `loadConfig` action (line 117), add to the `set()` call after `excludedSessions`:

```typescript
      excludedSessions: config.excludedSessions ?? [],
      archivedSessions: config.archivedSessions ?? [],
```

- [ ] **Step 3: Apply `isArchived` and `displayName` in `loadSessions`**

Replace the `loadSessions` action (lines 139-153) with:

```typescript
  loadSessions: async () => {
    const sessions = await window.cccAPI.session.list()
    const excluded = get().excludedSessions
    const archived = get().archivedSessions
    const config = await window.cccAPI.config.load()
    const displayNames = config.sessionDisplayNames ?? {}
    const marked = sessions.map((s: Session) => ({
      ...s,
      isExcluded: excluded.includes(s.name),
      isArchived: archived.includes(s.name),
      displayName: displayNames[s.name],
    }))
    set((state) => ({
      sessions: marked,
      loading: false,
      activeSessionId: state.activeSessionId && sessions.find(s => s.id === state.activeSessionId)
        ? state.activeSessionId
        : sessions[0]?.id ?? null
    }))
  },
```

- [ ] **Step 4: Add `toggleArchived` action**

Add after the `toggleExcluded` action (after line 317):

```typescript
  toggleArchived: async (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return
    await window.cccAPI.config.toggleArchived(session.name)
    const wasArchived = get().archivedSessions.includes(session.name)
    if (wasArchived) {
      // Unarchiving
      set({
        sessions: get().sessions.map(s =>
          s.id === sessionId ? { ...s, isArchived: false } : s
        ),
        archivedSessions: get().archivedSessions.filter(n => n !== session.name),
      })
    } else {
      // Archiving — also remove from excluded
      set({
        sessions: get().sessions.map(s =>
          s.id === sessionId ? { ...s, isArchived: true, isExcluded: false } : s
        ),
        archivedSessions: [...get().archivedSessions, session.name],
        excludedSessions: get().excludedSessions.filter(n => n !== session.name),
      })
    }
  },
```

- [ ] **Step 5: Add `setDisplayName` and `setRenamingSessionId` actions**

Add after `toggleArchived`:

```typescript
  setDisplayName: async (sessionId: string, displayName: string) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return
    await window.cccAPI.config.setDisplayName(session.name, displayName)
    set({
      sessions: get().sessions.map(s =>
        s.id === sessionId
          ? { ...s, displayName: displayName.trim() === '' ? undefined : displayName.trim() }
          : s
      ),
    })
  },

  setRenamingSessionId: (id: string | null) => set({ renamingSessionId: id }),
```

- [ ] **Step 6: Update `resetGridLayout` to account for archived sessions**

Replace the `resetGridLayout` action (lines 341-347):

```typescript
  resetGridLayout: () => {
    const { sessions, excludedSessions, archivedSessions, gridPresets } = get()
    const visibleIds = sessions
      .filter((s) => !excludedSessions.includes(s.name) && !archivedSessions.includes(s.name))
      .map((s) => s.id)
    const newLayout = visibleIds.length > 0 ? buildAutoGrid(visibleIds, gridPresets) : null
    set({ gridLayout: newLayout })
    void window.cccAPI.config.update({ gridLayout: null })
  },
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "feat: add archive, display name, and rename state to session store"
```

---

### Task 5: Grid View — Filter Archived Sessions

**Files:**
- Modify: `src/renderer/components/GridView.tsx:18`

- [ ] **Step 1: Update visible sessions filter**

In `src/renderer/components/GridView.tsx` line 18, change:

```typescript
  const visibleSessions = sessions.filter((s) => !s.isExcluded)
```

to:

```typescript
  const visibleSessions = sessions.filter((s) => !s.isExcluded && !s.isArchived)
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/GridView.tsx
git commit -m "feat: filter archived sessions from grid view"
```

---

### Task 6: Display Name in SplitPane and SessionCard

**Files:**
- Modify: `src/renderer/components/SplitPane.tsx:69`
- Modify: `src/renderer/components/SessionCard.tsx:88`

- [ ] **Step 1: Use display name in SplitPane grid tile**

In `src/renderer/components/SplitPane.tsx` line 69, change:

```typescript
            {session.name}
```

to:

```typescript
            {session.displayName || session.name}
```

- [ ] **Step 2: Use display name in SessionCard**

In `src/renderer/components/SessionCard.tsx` line 88, change:

```typescript
            {session.name}
```

to:

```typescript
            {session.displayName || session.name}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SplitPane.tsx src/renderer/components/SessionCard.tsx
git commit -m "feat: show display name in session card and grid tiles"
```

---

### Task 7: Inline Rename in SessionCard

**Files:**
- Modify: `src/renderer/components/SessionCard.tsx`

- [ ] **Step 1: Add rename input to SessionCard**

Replace the full `SessionCard` component in `src/renderer/components/SessionCard.tsx`. Key changes:
- Import `useRef` and `useEffect` from React
- Read `renamingSessionId` and `setRenamingSessionId` and `setDisplayName` from store
- When `renamingSessionId === session.id`, render an `<input>` instead of the name `<span>`

Replace the name span (the `<span>` at line 83-89) with:

```tsx
          {renamingSessionId === session.id ? (
            <input
              ref={renameInputRef}
              type="text"
              defaultValue={session.displayName || session.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setRenamingSessionId(null)
                }
              }}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim()
                if (value !== '' && value !== session.name) {
                  void setDisplayName(session.id, value)
                } else if (value === '' || value === session.name) {
                  void setDisplayName(session.id, '')
                }
                setRenamingSessionId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="text-[12px] font-semibold truncate flex-1 bg-transparent border-b outline-none"
              style={{
                color: isActive ? session.color : 'var(--text-primary)',
                borderColor: 'var(--accent)',
              }}
            />
          ) : (
            <span
              className="text-[12px] font-semibold truncate flex-1"
              style={{ color: isActive ? session.color : 'var(--text-primary)' }}
            >
              {session.displayName || session.name}
            </span>
          )}
```

Add these at the top of the component function:

```typescript
  const renamingSessionId = useSessionStore((s) => s.renamingSessionId)
  const setRenamingSessionId = useSessionStore((s) => s.setRenamingSessionId)
  const setDisplayName = useSessionStore((s) => s.setDisplayName)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingSessionId === session.id && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingSessionId, session.id])
```

Update the import line to include `useRef` and `useEffect`:

```typescript
import { useState, useRef, useEffect } from 'react'
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SessionCard.tsx
git commit -m "feat: add inline rename input to session card"
```

---

### Task 8: Context Menu — Rename, Exclude Label, Archive

**Files:**
- Modify: `src/renderer/components/GroupContextMenu.tsx`

- [ ] **Step 1: Add new store imports and restructure menu**

Replace the full context menu body in `src/renderer/components/GroupContextMenu.tsx`. Add new store selectors:

```typescript
  const toggleArchived = useSessionStore(s => s.toggleArchived)
  const setRenamingSessionId = useSessionStore(s => s.setRenamingSessionId)
  const archivedSessions = useSessionStore(s => s.archivedSessions)
```

Replace the menu items section (from the first `<div style={{ height: 1 ...` divider through the "Open in IDE" button) with the following restructured menu:

```tsx
        {/* Rename */}
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => { setRenamingSessionId(sessionId); onClose() }}
        >
          Rename...
        </button>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Visibility controls */}
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors flex items-center gap-2"
          onClick={() => { toggleExcluded(sessionId); onClose() }}
          style={{
            opacity: session?.isArchived ? 0.4 : 1,
            pointerEvents: session?.isArchived ? 'none' : 'auto',
          }}
        >
          <span className="w-4 text-center text-[10px]">{session?.isExcluded ? '✓' : ''}</span>
          Exclude from grid
        </button>
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => { toggleArchived(sessionId); onClose() }}
        >
          {session && archivedSessions.includes(session.name) ? 'Unarchive' : 'Archive'}
        </button>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* Existing actions */}
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => { toggleMuted(sessionId); onClose() }}
        >
          {session && mutedSessions.includes(session.name) ? 'Unmute notifications' : 'Mute notifications'}
        </button>
        {!session?.remoteHost && (
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={() => { openFolder(sessionId); onClose() }}
          >
            Open folder
          </button>
        )}
        {ideCommand && !session?.remoteHost && (
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={() => { openInIde(sessionId); onClose() }}
          >
            Open in IDE
          </button>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/GroupContextMenu.tsx
git commit -m "feat: restructure context menu with rename, exclude from grid, and archive"
```

---

### Task 9: Sidebar — Archived Section and Updated Footer

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Add archived section and update footer**

In `src/renderer/components/SessionSidebar.tsx`, make these changes:

Add `ChevronDown` and `ChevronRight` to the import if not already there (they're already imported), and add `Archive` from lucide-react:

```typescript
import { Plus, LayoutGrid, Monitor, SquareTerminal, ChevronDown, ChevronRight, Search, Server, GitBranch, Archive } from 'lucide-react'
```

Add state for archived section collapse (add near line 244 with the other useState):

```typescript
  const [archivedOpen, setArchivedOpen] = useState(false)
```

Split `filtered` sessions into active and archived. After the `filtered` variable (line 248), add:

```typescript
  const activeSessions = filtered.filter((s) => !s.isArchived)
  const archivedFiltered = filtered.filter((s) => s.isArchived)
```

Update all session type filters to use `activeSessions` instead of `filtered`:

```typescript
  const claudeSessions = activeSessions.filter((s) => s.type === 'claude')
  const geminiSessions = activeSessions.filter((s) => s.type === 'gemini')
  const shellSessions = activeSessions.filter((s) => s.type === 'shell')
```

Update `localSessions` to use `activeSessions`:

```typescript
  const localSessions = activeSessions.filter((s) => !s.remoteHost)
```

Update remote host filtering to use `activeSessions`:

```typescript
              .filter((rh) => activeSessions.some((s) => s.remoteHost === rh.name))
```

And for each remote host's sessions:

```typescript
                const hostSessions = activeSessions.filter((s) => s.remoteHost === rh.name)
```

Add counts:

```typescript
  const archivedCount = sessions.filter((s) => s.isArchived).length
  const excludedCount = sessions.filter((s) => s.isExcluded && !s.isArchived).length
```

Add the archived section at the end of the session list `<div>` (before the empty states), after the closing `</>` of the ternary for `hasRemoteHosts`:

```tsx
        {archivedFiltered.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setArchivedOpen(!archivedOpen)}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]"
            >
              {archivedOpen
                ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
                : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
              }
              <Archive size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
              <span className="text-[11px] font-semibold flex-1 text-left" style={{ color: 'var(--text-muted)' }}>
                Archived
              </span>
              <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                {archivedFiltered.length}
              </span>
            </button>
            {archivedOpen && (
              <div className="flex flex-col gap-1 mt-0.5 ml-1">
                {archivedFiltered.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onClick={() => setActiveSession(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
```

Update the footer to show separate counts. Replace the footer `<span>` (lines 413-420):

```tsx
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {runningCount}/{sessions.length}
          {excludedCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {' '}· {excludedCount} excluded
            </span>
          )}
          {archivedCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {' '}· {archivedCount} archived
            </span>
          )}
        </span>
```

- [ ] **Step 2: Update search to match display names**

In the `filtered` computation (line 247), update to also search display names:

```typescript
  const filtered = searchQuery
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.displayName && s.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions
```

- [ ] **Step 3: Apply dimmed styling for archived sessions in SessionCard**

In `src/renderer/components/SessionCard.tsx`, update the opacity line (line 66) to also dim archived sessions:

```typescript
        opacity: session.isExcluded || session.isArchived ? 0.4 : 1,
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx src/renderer/components/SessionCard.tsx
git commit -m "feat: add archived section to sidebar with collapsible list and updated footer"
```

---

### Task 10: Typecheck and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: No lint errors (fix any that appear)

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any lint/type fixes were needed**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues"
```
