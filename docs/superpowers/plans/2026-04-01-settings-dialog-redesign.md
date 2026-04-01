# Settings Dialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal tab bar settings dialog with a vertical sidebar navigation layout and split the 1264-line monolith into focused components.

**Architecture:** Extract each tab's content into its own component under `src/renderer/components/settings/`. Build a new `SettingsModal.tsx` shell with a 180px sidebar (grouped nav with Lucide icons) and a content panel that renders the active tab component. Fix styling inconsistencies to use standard CSS variables throughout.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React icons, Zustand (existing store reads)

---

### Task 1: Create settings directory and SettingsSidebar component

**Files:**
- Create: `src/renderer/components/settings/SettingsSidebar.tsx`

- [ ] **Step 1: Create the settings directory**

```bash
mkdir -p src/renderer/components/settings
```

- [ ] **Step 2: Write SettingsSidebar component**

Create `src/renderer/components/settings/SettingsSidebar.tsx`:

```tsx
import { Sun, Zap, Monitor, Folder, GitBranch, Server, Box, Settings } from 'lucide-react'

export type Tab = 'appearance' | 'features' | 'providers' | 'favorites' | 'worktrees' | 'remotes' | 'containers' | 'advanced'

interface NavItem {
  id: Tab
  label: string
  icon: React.ComponentType<{ size?: number }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Sun },
      { id: 'features', label: 'Features', icon: Zap },
    ],
  },
  {
    label: 'Sessions',
    items: [
      { id: 'providers', label: 'AI Providers', icon: Monitor },
      { id: 'favorites', label: 'Favorites', icon: Folder },
      { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
    ],
  },
  {
    label: 'Connections',
    items: [
      { id: 'remotes', label: 'Remote Hosts', icon: Server },
      { id: 'containers', label: 'Containers', icon: Box },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'advanced', label: 'Advanced', icon: Settings },
    ],
  },
]

export default function SettingsSidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }): React.JSX.Element {
  return (
    <div
      className="w-[180px] flex-shrink-0 border-r overflow-y-auto py-4 px-2.5"
      style={{ borderColor: 'var(--bg-raised)' }}
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div
            className="text-[9px] uppercase tracking-[1.2px] font-semibold px-2.5 pt-3 pb-1.5 first:pt-0"
            style={{ color: 'var(--text-muted)' }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-xs transition-colors duration-100"
                style={{
                  backgroundColor: isActive ? 'var(--bg-raised)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/SettingsSidebar.tsx
git commit -m "feat(settings): add SettingsSidebar component with grouped navigation"
```

---

### Task 2: Extract AppearanceSettings

**Files:**
- Create: `src/renderer/components/settings/AppearanceSettings.tsx`

- [ ] **Step 1: Write AppearanceSettings component**

Create `src/renderer/components/settings/AppearanceSettings.tsx`. Extract the `tab === 'appearance'` block (lines 743-808 of the current SettingsModal.tsx). The component reads from Zustand directly — no props needed.

```tsx
import { useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'

export default function AppearanceSettings(): React.JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)
  const [zoomFactor, setZoomFactor] = useState(1.0)

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setZoomFactor(config.zoomFactor ?? 1.0)
    })
  }, [])

  const resetSidebarWidth = (): void => {
    setSidebarWidth(260)
    void persistSidebarWidth()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Theme toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Currently {theme}
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      {/* Zoom Factor */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Zoom</div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {Math.round((zoomFactor ?? 1.0) * 100)}%
          </div>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={zoomFactor ?? 1.0}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            setZoomFactor(val)
            window.cccAPI.window.setZoomFactor(val)
            void window.cccAPI.config.update({ zoomFactor: val })
          }}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          <span>50%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Sidebar width reset */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Sidebar Width</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Reset to default (260px)
          </div>
        </div>
        <button
          onClick={resetSidebarWidth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/AppearanceSettings.tsx
git commit -m "feat(settings): extract AppearanceSettings component"
```

---

### Task 3: Extract ProvidersSettings

**Files:**
- Create: `src/renderer/components/settings/ProvidersSettings.tsx`

- [ ] **Step 1: Write ProvidersSettings component**

Create `src/renderer/components/settings/ProvidersSettings.tsx`. Extract the `tab === 'providers'` block (lines 267-338 of current file). Contains the Claude and Gemini provider cards with enable/disable toggles.

```tsx
import { useSessionStore } from '../../stores/session-store'
import type { AiProvider } from '../../../shared/types'

export default function ProvidersSettings(): React.JSX.Element {
  const enabledProviders = useSessionStore((s) => s.enabledProviders)
  const setEnabledProviders = useSessionStore((s) => s.setEnabledProviders)

  const toggleProvider = (provider: AiProvider): void => {
    const next = enabledProviders.includes(provider)
      ? enabledProviders.filter(p => p !== provider)
      : [...enabledProviders, provider] as AiProvider[]
    void setEnabledProviders(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Claude */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width={16} height={16} viewBox="0 0 1200 1200" fill="none">
              <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill="#D97757" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Claude Code</span>
          </div>
          <button
            onClick={() => toggleProvider('claude')}
            className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
            style={{
              backgroundColor: enabledProviders.includes('claude') ? 'var(--success)' : 'var(--bg-raised)',
              color: enabledProviders.includes('claude') ? '#1d1f21' : 'var(--text-muted)'
            }}
          >
            {enabledProviders.includes('claude') ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        {enabledProviders.includes('claude') && (
          <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Requires <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)' }}>claude</code> in PATH
          </div>
        )}
      </div>

      {/* Gemini */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width={16} height={16} viewBox="0 0 28 28" fill="none">
              <path d="M14 28C14 21.77 9.94 16.66 4.42 15.08C2.91 14.64 1.36 14.38 0 14.25V13.75C1.36 13.62 2.91 13.36 4.42 12.92C9.94 11.34 14 6.23 14 0C14 6.23 18.06 11.34 23.58 12.92C25.09 13.36 26.64 13.62 28 13.75V14.25C26.64 14.38 25.09 14.64 23.58 15.08C18.06 16.66 14 21.77 14 28Z" fill="#4285F4" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini CLI</span>
          </div>
          <button
            onClick={() => toggleProvider('gemini')}
            className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
            style={{
              backgroundColor: enabledProviders.includes('gemini') ? 'var(--success)' : 'var(--bg-raised)',
              color: enabledProviders.includes('gemini') ? '#1d1f21' : 'var(--text-muted)'
            }}
          >
            {enabledProviders.includes('gemini') ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        {enabledProviders.includes('gemini') && (
          <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Requires <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)' }}>gemini</code> in PATH
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/ProvidersSettings.tsx
git commit -m "feat(settings): extract ProvidersSettings component"
```

---

### Task 4: Extract FavoritesSettings

**Files:**
- Create: `src/renderer/components/settings/FavoritesSettings.tsx`

- [ ] **Step 1: Write FavoritesSettings component**

Create `src/renderer/components/settings/FavoritesSettings.tsx`. Extract the `tab === 'favorites'` block (lines 341-397). Contains the favorites list with inline edit/add forms.

```tsx
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { FavoriteFolder } from '../../../shared/types'

export default function FavoritesSettings(): React.JSX.Element {
  const favorites = useSessionStore((s) => s.favorites)
  const setFavorites = useSessionStore((s) => s.setFavorites)

  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addMode, setAddMode] = useState(false)

  const startEdit = (idx: number): void => {
    setEditIdx(idx)
    setEditForm({ ...favorites[idx] })
    setAddMode(false)
  }

  const startAdd = (): void => {
    setAddMode(true)
    setEditIdx(null)
    setEditForm({ name: '', path: '', defaultBranch: 'main' })
  }

  const saveEdit = (): void => {
    if (!editForm.name.trim() || !editForm.path.trim()) return
    const updated = [...favorites]
    if (addMode) {
      updated.push({ ...editForm })
    } else if (editIdx !== null) {
      updated[editIdx] = { ...editForm }
    }
    void setFavorites(updated)
    setEditIdx(null)
    setAddMode(false)
  }

  const cancelEdit = (): void => {
    setEditIdx(null)
    setAddMode(false)
  }

  const removeFavorite = (idx: number): void => {
    const updated = favorites.filter((_, i) => i !== idx)
    void setFavorites(updated)
    if (editIdx === idx) setEditIdx(null)
  }

  const inlineForm = (
    <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
      <input
        type="text"
        value={editForm.name}
        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
        placeholder="Name (e.g. api-server)"
        autoFocus
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.path}
        onChange={(e) => setEditForm({ ...editForm, path: e.target.value })}
        placeholder="Path (e.g. ~/projects/api-server)"
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.defaultBranch}
        onChange={(e) => setEditForm({ ...editForm, defaultBranch: e.target.value })}
        placeholder="Default branch (e.g. main)"
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.worktreePath ?? ''}
        onChange={(e) => setEditForm({ ...editForm, worktreePath: e.target.value || undefined })}
        placeholder="Worktree path override (optional)"
        className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={cancelEdit}
          className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={saveEdit}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
        >
          <Check size={11} />
          Save
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-2">
      {favorites.map((fav, idx) =>
        editIdx === idx ? (
          <div key={idx}>{inlineForm}</div>
        ) : (
          <div
            key={idx}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
            style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {fav.name}
              </div>
              <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {fav.path}
              </div>
            </div>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
            >
              {fav.defaultBranch}
            </span>
            <button
              onClick={() => startEdit(idx)}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => removeFavorite(idx)}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )
      )}

      {addMode ? (
        inlineForm
      ) : (
        <button
          onClick={startAdd}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          <Plus size={12} />
          Add Favorite
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/FavoritesSettings.tsx
git commit -m "feat(settings): extract FavoritesSettings component"
```

---

### Task 5: Extract WorktreesSettings

**Files:**
- Create: `src/renderer/components/settings/WorktreesSettings.tsx`

- [ ] **Step 1: Write WorktreesSettings component**

Create `src/renderer/components/settings/WorktreesSettings.tsx`. Extract the `tab === 'worktrees'` block (lines 810-852).

```tsx
import { useSessionStore } from '../../stores/session-store'

export default function WorktreesSettings(): React.JSX.Element {
  const worktreeBasePath = useSessionStore((s) => s.worktreeBasePath)
  const worktreeSyncPaths = useSessionStore((s) => s.worktreeSyncPaths)

  return (
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
            useSessionStore.setState({ worktreeBasePath: e.target.value })
          }}
          placeholder="~/worktrees"
          className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Worktrees will be created at this path / repo name / branch name
        </p>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          Sync Paths
        </label>
        <textarea
          defaultValue={worktreeSyncPaths.join('\n')}
          onBlur={(e) => {
            const paths = e.target.value.split('\n').map(p => p.trim()).filter(Boolean)
            void window.cccAPI.config.update({ worktreeSyncPaths: paths })
            useSessionStore.setState({ worktreeSyncPaths: paths })
          }}
          rows={4}
          placeholder={".claude\nCLAUDE.md"}
          className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)] font-mono"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)', resize: 'vertical' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Files and folders to copy from the source repo into new worktrees (one per line)
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/WorktreesSettings.tsx
git commit -m "feat(settings): extract WorktreesSettings component"
```

---

### Task 6: Extract RemotesSettings

**Files:**
- Create: `src/renderer/components/settings/RemotesSettings.tsx`

- [ ] **Step 1: Write RemotesSettings component**

Create `src/renderer/components/settings/RemotesSettings.tsx`. Extract the `tab === 'remotes'` block (lines 399-741). This is the largest tab — contains remote host CRUD with nested favorite folders per host. Copy the entire block verbatim, moving all related state into this component.

```tsx
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, Server, ChevronDown, ChevronRight } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { FavoriteFolder, RemoteHost } from '../../../shared/types'

export default function RemotesSettings(): React.JSX.Element {
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const setRemoteHosts = useSessionStore((s) => s.setRemoteHosts)

  const [editRemoteIdx, setEditRemoteIdx] = useState<number | null>(null)
  const [editRemoteForm, setEditRemoteForm] = useState<{ name: string; host: string; shell: string }>({ name: '', host: '', shell: '' })
  const [addRemoteMode, setAddRemoteMode] = useState(false)
  const [expandedRemote, setExpandedRemote] = useState<number | null>(null)
  const [editRemoteFavIdx, setEditRemoteFavIdx] = useState<number | null>(null)
  const [editRemoteFavForm, setEditRemoteFavForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addRemoteFavMode, setAddRemoteFavMode] = useState(false)

  const saveRemoteHosts = (updated: RemoteHost[]): void => {
    void setRemoteHosts(updated)
  }

  return (
    <div className="flex flex-col gap-2">
      {remoteHosts.map((rh, idx) =>
        editRemoteIdx === idx ? (
          <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
            <input
              type="text"
              value={editRemoteForm.name}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
              placeholder="Name (e.g. dev-server)"
              autoFocus
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              value={editRemoteForm.host}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
              placeholder="SSH host (e.g. user@192.168.1.100)"
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <input
              type="text"
              value={editRemoteForm.shell}
              onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
              placeholder="Shell (default: /bin/bash)"
              className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditRemoteIdx(null)}
                className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                  const updated = [...remoteHosts]
                  updated[idx] = { ...updated[idx], name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined }
                  saveRemoteHosts(updated)
                  setEditRemoteIdx(null)
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
              >
                <Check size={11} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div key={idx}>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
              style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
            >
              <button
                onClick={() => setExpandedRemote(expandedRemote === idx ? null : idx)}
                className="p-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {expandedRemote === idx ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
              <Server size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {rh.name}
                </div>
                <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {rh.host}
                </div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                {rh.favoriteFolders.length} favorites
              </span>
              <button
                onClick={() => {
                  setEditRemoteIdx(idx)
                  setEditRemoteForm({ name: rh.name, host: rh.host, shell: rh.shell || '' })
                  setAddRemoteMode(false)
                }}
                className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => {
                  const updated = remoteHosts.filter((_, i) => i !== idx)
                  saveRemoteHosts(updated)
                  if (expandedRemote === idx) setExpandedRemote(null)
                }}
                className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Expanded: per-host favorite folders */}
            {expandedRemote === idx && (
              <div className="ml-6 mt-1 flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-wide font-medium px-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                  Favorite Folders
                </div>
                {rh.favoriteFolders.map((fav, fIdx) =>
                  editRemoteFavIdx === fIdx ? (
                    <div key={fIdx} className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                      <input
                        type="text"
                        value={editRemoteFavForm.name}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                        placeholder="Name"
                        autoFocus
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editRemoteFavForm.path}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                        placeholder="Path"
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editRemoteFavForm.defaultBranch}
                        onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                        placeholder="Default branch"
                        className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setEditRemoteFavIdx(null); setAddRemoteFavMode(false) }}
                          className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                            const updated = [...remoteHosts]
                            const favs = [...updated[idx].favoriteFolders]
                            if (addRemoteFavMode) {
                              favs.push({ ...editRemoteFavForm })
                            } else {
                              favs[fIdx] = { ...editRemoteFavForm }
                            }
                            updated[idx] = { ...updated[idx], favoriteFolders: favs }
                            saveRemoteHosts(updated)
                            setEditRemoteFavIdx(null)
                            setAddRemoteFavMode(false)
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                        >
                          <Check size={10} />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={fIdx}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border"
                      style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{fav.name}</span>
                        <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{fav.path}</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditRemoteFavIdx(fIdx)
                          setEditRemoteFavForm({ ...fav })
                          setAddRemoteFavMode(false)
                        }}
                        className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => {
                          const updated = [...remoteHosts]
                          updated[idx] = { ...updated[idx], favoriteFolders: updated[idx].favoriteFolders.filter((_, i) => i !== fIdx) }
                          saveRemoteHosts(updated)
                        }}
                        className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )
                )}

                {addRemoteFavMode && editRemoteFavIdx === null ? (
                  <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                    <input
                      type="text"
                      value={editRemoteFavForm.name}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                      placeholder="Name"
                      autoFocus
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteFavForm.path}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                      placeholder="Path"
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteFavForm.defaultBranch}
                      onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                      placeholder="Default branch"
                      className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setAddRemoteFavMode(false) }}
                        className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                          const updated = [...remoteHosts]
                          const favs = [...updated[idx].favoriteFolders, { ...editRemoteFavForm }]
                          updated[idx] = { ...updated[idx], favoriteFolders: favs }
                          saveRemoteHosts(updated)
                          setAddRemoteFavMode(false)
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                      >
                        <Check size={10} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : !addRemoteFavMode && (
                  <button
                    onClick={() => {
                      setAddRemoteFavMode(true)
                      setEditRemoteFavIdx(null)
                      setEditRemoteFavForm({ name: '', path: '', defaultBranch: 'main' })
                    }}
                    className="flex items-center justify-center gap-1 w-full py-1.5 rounded-md border border-dashed text-[10px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                  >
                    <Plus size={10} />
                    Add Folder
                  </button>
                )}
              </div>
            )}
          </div>
        )
      )}

      {addRemoteMode ? (
        <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
          <input
            type="text"
            value={editRemoteForm.name}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
            placeholder="Name (e.g. dev-server)"
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={editRemoteForm.host}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
            placeholder="SSH host (e.g. user@192.168.1.100)"
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <input
            type="text"
            value={editRemoteForm.shell}
            onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
            placeholder="Shell (default: /bin/bash)"
            className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setAddRemoteMode(false)}
              className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                const updated = [...remoteHosts, { name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined, favoriteFolders: [] }]
                saveRemoteHosts(updated)
                setAddRemoteMode(false)
                setEditRemoteForm({ name: '', host: '', shell: '' })
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
            >
              <Check size={11} />
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setAddRemoteMode(true)
            setEditRemoteIdx(null)
            setEditRemoteForm({ name: '', host: '', shell: '' })
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
        >
          <Plus size={12} />
          Add Remote Host
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/RemotesSettings.tsx
git commit -m "feat(settings): extract RemotesSettings component"
```

---

### Task 7: Extract ContainersSettings

**Files:**
- Create: `src/renderer/components/settings/ContainersSettings.tsx`

- [ ] **Step 1: Write ContainersSettings component**

Create `src/renderer/components/settings/ContainersSettings.tsx`. Extract the `tab === 'containers'` block (lines 1038-1174).

```tsx
import { useState } from 'react'
import { Plus, Trash2, Pencil, Check, Box } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { ContainerConfig } from '../../../shared/types'

export default function ContainersSettings(): React.JSX.Element {
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const containers = useSessionStore((s) => s.containers)
  const setContainers = useSessionStore((s) => s.setContainers)
  const enableContainers = useSessionStore((s) => s.enableContainers)
  const setEnableContainers = useSessionStore((s) => s.setEnableContainers)

  const [addContainerMode, setAddContainerMode] = useState(false)
  const [newContainer, setNewContainer] = useState<ContainerConfig>({ name: '' })
  const [editContainerIdx, setEditContainerIdx] = useState<number | null>(null)
  const [editContainerLabel, setEditContainerLabel] = useState('')

  return (
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
                    value={editContainerLabel}
                    onChange={(e) => setEditContainerLabel(e.target.value)}
                    placeholder="Label"
                  />
                  <button onClick={() => {
                    const updated = [...containers]
                    updated[editContainerIdx!] = { ...updated[editContainerIdx!], label: editContainerLabel || undefined }
                    void setContainers(updated)
                    setEditContainerIdx(null)
                  }}>
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
                  <button onClick={() => {
                    setEditContainerIdx(idx)
                    setEditContainerLabel(containers[idx].label ?? containers[idx].name)
                  }}>
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
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/ContainersSettings.tsx
git commit -m "feat(settings): extract ContainersSettings component"
```

---

### Task 8: Extract FeaturesSettings

**Files:**
- Create: `src/renderer/components/settings/FeaturesSettings.tsx`

- [ ] **Step 1: Write FeaturesSettings component**

Create `src/renderer/components/settings/FeaturesSettings.tsx`. Extract the `tab === 'features'` block (lines 1176-1259). Note: fix the inconsistent styling — use `--bg-primary`/`--bg-raised` instead of any stale variable names.

```tsx
import { useState, useEffect } from 'react'
import { useSessionStore } from '../../stores/session-store'

export default function FeaturesSettings(): React.JSX.Element {
  const [featuresConfig, setFeaturesConfig] = useState({ pullRequests: false, containers: false })
  const [prOrg, setPrOrg] = useState('')
  const [prRepos, setPrRepos] = useState('')
  const [prMembers, setPrMembers] = useState('')
  const [prPollInterval, setPrPollInterval] = useState(120)
  const [prShowMyDrafts, setPrShowMyDrafts] = useState(true)
  const [prShowOthersDrafts, setPrShowOthersDrafts] = useState(false)

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setFeaturesConfig(config.features ?? { pullRequests: false, containers: false })
      if (config.prConfig) {
        setPrOrg(config.prConfig.githubOrg ?? '')
        setPrRepos(config.prConfig.pinnedRepos?.join(', ') ?? '')
        setPrMembers(config.prConfig.teamMembers?.join(', ') ?? '')
        setPrPollInterval(config.prConfig.pollInterval ?? 120)
        setPrShowMyDrafts(config.prConfig.showMyDrafts !== false)
        setPrShowOthersDrafts(config.prConfig.showOthersDrafts === true)
      }
    })
  }, [])

  const saveFeatures = (features: { pullRequests: boolean; containers: boolean }): void => {
    setFeaturesConfig(features)
    void window.cccAPI.config.update({ features })
    void useSessionStore.getState().loadConfig()
  }

  const savePrConfig = (): void => {
    void window.cccAPI.config.update({
      prConfig: {
        githubOrg: prOrg,
        pinnedRepos: prRepos.split(',').map(r => r.trim()).filter(Boolean),
        teamMembers: prMembers.split(',').map(m => m.trim()).filter(Boolean),
        pollInterval: prPollInterval,
        showMyDrafts: prShowMyDrafts,
        showOthersDrafts: prShowOthersDrafts,
        notifications: { approved: true, changesRequested: true, newComment: true, newReviewer: true, newPr: true },
        dismissedAttention: [],
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Features</h3>
      <label className="flex items-center justify-between">
        <div>
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Pull Requests</span>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Monitor GitHub PRs in the sidebar</p>
        </div>
        <input
          type="checkbox"
          checked={featuresConfig.pullRequests}
          onChange={(e) => saveFeatures({ ...featuresConfig, pullRequests: e.target.checked })}
          className="accent-[var(--accent)]"
        />
      </label>

      {featuresConfig.pullRequests && (
        <>
          <hr style={{ borderColor: 'var(--bg-raised)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PR Configuration</h3>

          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>GitHub Organization</label>
            <input
              type="text"
              value={prOrg}
              onChange={(e) => setPrOrg(e.target.value)}
              onBlur={savePrConfig}
              className="w-full px-2 py-1.5 rounded text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Pinned Repos (comma-separated)</label>
            <input
              type="text"
              value={prRepos}
              onChange={(e) => setPrRepos(e.target.value)}
              onBlur={savePrConfig}
              className="w-full px-2 py-1.5 rounded text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Team Members (comma-separated usernames)</label>
            <input
              type="text"
              value={prMembers}
              onChange={(e) => setPrMembers(e.target.value)}
              onBlur={savePrConfig}
              className="w-full px-2 py-1.5 rounded text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Poll Interval (seconds, 30-300)</label>
            <input
              type="number"
              min={30}
              max={300}
              value={prPollInterval}
              onChange={(e) => setPrPollInterval(Number(e.target.value))}
              onBlur={savePrConfig}
              className="w-20 px-2 py-1.5 rounded text-xs border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          <label className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show my drafts</span>
            <input type="checkbox" checked={prShowMyDrafts} onChange={(e) => { setPrShowMyDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
          </label>

          <label className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show others' drafts</span>
            <input type="checkbox" checked={prShowOthersDrafts} onChange={(e) => { setPrShowOthersDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
          </label>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/FeaturesSettings.tsx
git commit -m "feat(settings): extract FeaturesSettings component"
```

---

### Task 9: Extract AdvancedSettings

**Files:**
- Create: `src/renderer/components/settings/AdvancedSettings.tsx`

- [ ] **Step 1: Write AdvancedSettings component**

Create `src/renderer/components/settings/AdvancedSettings.tsx`. Extract the `tab === 'advanced'` block (lines 854-1036). **Fix the inconsistent styling:** replace `var(--bg-tertiary)` with `var(--bg-primary)` and `var(--border)` with `var(--bg-raised)` throughout this component.

```tsx
import { useState, useEffect } from 'react'
import { useSessionStore } from '../../stores/session-store'
import type { ClaudeConfigRoute } from '../../../shared/types'

export default function AdvancedSettings(): React.JSX.Element {
  const dangerouslySkipPermissions = useSessionStore(s => s.dangerouslySkipPermissions)
  const setDangerouslySkipPermissions = useSessionStore(s => s.setDangerouslySkipPermissions)
  const ideCommand = useSessionStore(s => s.ideCommand)
  const setIdeCommand = useSessionStore(s => s.setIdeCommand)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)

  const [editRouteIdx, setEditRouteIdx] = useState<number | null>(null)
  const [editRouteForm, setEditRouteForm] = useState({ pathPrefix: '', configDir: '' })
  const [addRouteMode, setAddRouteMode] = useState(false)
  const [claudeConfigRoutes, setClaudeConfigRoutes] = useState<ClaudeConfigRoute[]>([])
  const [defaultClaudeConfigDir, setDefaultClaudeConfigDir] = useState('')

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setClaudeConfigRoutes(config.claudeConfigRoutes ?? [])
      setDefaultClaudeConfigDir(config.defaultClaudeConfigDir ?? '')
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* IDE Command */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>IDE Command</h3>
        <input
          className="w-full px-3 py-2 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          placeholder="code"
          value={ideCommand}
          onChange={(e) => setIdeCommand(e.target.value)}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Command to open working directory in your editor (e.g. code, cursor, rider)
        </p>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="rounded accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Show notifications when sessions finish or need input
          </span>
        </label>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          OS notifications when app is unfocused, in-app toasts when focused
        </p>
      </div>

      {/* Skip Permissions */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Skip Permissions</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dangerouslySkipPermissions}
            onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
            className="rounded accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Pass --dangerously-skip-permissions to new Claude sessions
          </span>
        </label>
        <p className="text-[10px] mt-1" style={{ color: 'var(--warning, #f59e0b)' }}>
          Warning: This allows Claude to execute commands without confirmation
        </p>
      </div>

      {/* Claude Config Routing */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Claude Config Routing</h3>
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Route sessions to different Claude configurations based on working directory
        </p>

        {/* Default config dir */}
        <div className="mb-3">
          <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Default Config Dir</label>
          <input
            className="w-full px-3 py-2 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
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
                className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Path prefix (~/Dev/Project)"
                value={editRouteForm.pathPrefix}
                onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
              />
              <input
                className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Config dir (~/.claude-project)"
                value={editRouteForm.configDir}
                onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
              />
              <button
                className="px-2.5 py-1 rounded text-[11px] font-medium"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                onClick={() => {
                  const updated = [...claudeConfigRoutes]
                  updated[i] = editRouteForm
                  setClaudeConfigRoutes(updated)
                  window.cccAPI.config.update({ claudeConfigRoutes: updated })
                  setEditRouteIdx(null)
                }}
              >Save</button>
              <button
                className="px-2 py-1 rounded text-[11px]"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => setEditRouteIdx(null)}
              >Cancel</button>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{route.pathPrefix}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>→</span>
              <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{route.configDir}</span>
              <button
                className="text-[10px] px-2 py-1 rounded hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => { setEditRouteIdx(i); setEditRouteForm(route) }}
              >Edit</button>
              <button
                className="text-[10px] px-2 py-1 rounded hover:bg-[var(--bg-raised)]"
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
              className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              placeholder="Path prefix (~/Dev/Project)"
              value={editRouteForm.pathPrefix}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
            />
            <input
              className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              placeholder="Config dir (~/.claude-project)"
              value={editRouteForm.configDir}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
            />
            <button
              className="px-2.5 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
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
              className="px-2 py-1 rounded text-[11px]"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => { setAddRouteMode(false); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
            >Cancel</button>
          </div>
        ) : (
          <button
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
            onClick={() => { setAddRouteMode(true); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
          >
            + Add route
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/AdvancedSettings.tsx
git commit -m "feat(settings): extract AdvancedSettings with consistent CSS variables"
```

---

### Task 10: Rewrite SettingsModal shell with sidebar layout

**Files:**
- Rewrite: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Replace SettingsModal.tsx with the new shell**

Replace the entire contents of `src/renderer/components/SettingsModal.tsx` with:

```tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SettingsSidebar, { type Tab } from './settings/SettingsSidebar'
import AppearanceSettings from './settings/AppearanceSettings'
import FeaturesSettings from './settings/FeaturesSettings'
import ProvidersSettings from './settings/ProvidersSettings'
import FavoritesSettings from './settings/FavoritesSettings'
import WorktreesSettings from './settings/WorktreesSettings'
import RemotesSettings from './settings/RemotesSettings'
import ContainersSettings from './settings/ContainersSettings'
import AdvancedSettings from './settings/AdvancedSettings'

const TAB_TITLES: Record<Tab, string> = {
  appearance: 'Appearance',
  features: 'Features',
  providers: 'AI Providers',
  favorites: 'Favorites',
  worktrees: 'Worktrees',
  remotes: 'Remote Hosts',
  containers: 'Containers',
  advanced: 'Advanced',
}

const TAB_COMPONENTS: Record<Tab, React.ComponentType> = {
  appearance: AppearanceSettings,
  features: FeaturesSettings,
  providers: ProvidersSettings,
  favorites: FavoritesSettings,
  worktrees: WorktreesSettings,
  remotes: RemotesSettings,
  containers: ContainersSettings,
  advanced: AdvancedSettings,
}

export default function SettingsModal(): React.JSX.Element {
  const settingsOpen = useSessionStore((s) => s.settingsOpen)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const [tab, setTab] = useState<Tab>('appearance')

  if (!settingsOpen) return <></>

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleSettings()
  }

  const ActiveTab = TAB_COMPONENTS[tab]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[720px] h-[80vh] flex rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        {/* Sidebar */}
        <SettingsSidebar activeTab={tab} onTabChange={setTab} />

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {TAB_TITLES[tab]}
            </h2>
            <button
              onClick={toggleSettings}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Verify it runs**

Run: `pnpm dev`

Open the app, click the settings gear icon. Verify:
- Modal opens at 720px wide with sidebar on the left
- All 8 navigation items are visible in the sidebar with icons and group headers
- Clicking each nav item switches the content panel
- All settings within each tab function correctly (toggle theme, add/remove favorites, etc.)
- Close button works, clicking backdrop closes modal

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat(settings): rewrite SettingsModal with sidebar navigation layout"
```

---

### Task 11: Clean up old file and verify

**Files:**
- Verify: all files under `src/renderer/components/settings/`
- Verify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: no errors (or only pre-existing ones)

- [ ] **Step 3: Verify no stale CSS variables remain**

Search for `--bg-tertiary` and `--border` in the settings directory — these should not appear:

```bash
grep -r "bg-tertiary\|var(--border)" src/renderer/components/settings/
```

Expected: no matches

- [ ] **Step 4: Commit any lint fixes if needed**

```bash
git add -A src/renderer/components/settings/
git commit -m "chore(settings): lint fixes and cleanup"
```
