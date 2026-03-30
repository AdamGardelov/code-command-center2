# Config, Settings & Favorites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user preferences to `~/.ccc/config.json`, add a settings modal for managing favorites and appearance, and integrate favorites into session creation.

**Architecture:** ConfigService in main process reads/writes JSON. Exposed via IPC to renderer. Session store loads config on startup, persists changes via IPC. Settings modal with tabs for Favorites and Appearance. NewSessionModal shows clickable favorites list.

**Tech Stack:** Electron IPC, Zustand, fs (Node), React

---

## File Map

```
src/
├── main/
│   ├── config-service.ts          # New: read/write ~/.ccc/config.json
│   ├── ipc/
│   │   └── config.ts              # New: config IPC handlers
│   ├── index.ts                   # Modified: init ConfigService, pass to session-manager
│   └── session-manager.ts         # Modified: accept config for color persistence
├── preload/
│   └── index.ts                   # Modified: add config API
├── renderer/
│   ├── components/
│   │   ├── SettingsModal.tsx       # New: settings with Favorites + Appearance tabs
│   │   ├── NewSessionModal.tsx     # Modified: favorites list at top
│   │   ├── SessionSidebar.tsx      # Modified: wire settings button
│   │   └── Layout.tsx             # Modified: persist sidebar width on drag end, render SettingsModal
│   ├── stores/
│   │   └── session-store.ts       # Modified: config loading, settingsOpen, favorites, persist actions
│   └── App.tsx                    # Modified: load config on startup
└── shared/
    └── types.ts                   # Modified: add FavoriteFolder, CccConfig, extend CccAPI
```

---

### Task 1: Add Config Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add FavoriteFolder, CccConfig, and extend CccAPI**

Add these types to `src/shared/types.ts` (after `Theme` type, before `CccAPI`):

```typescript
export interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
}

export interface CccConfig {
  theme: Theme
  sidebarWidth: number
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
}
```

Add `config` to the `CccAPI` interface:

```typescript
  config: {
    load: () => Promise<CccConfig>
    update: (partial: Partial<CccConfig>) => Promise<CccConfig>
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "Add FavoriteFolder, CccConfig types and config API to CccAPI"
```

---

### Task 2: ConfigService (Main Process)

**Files:**
- Create: `src/main/config-service.ts`

- [ ] **Step 1: Create ConfigService**

Write `src/main/config-service.ts`:

```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { CccConfig } from '../shared/types'

const CONFIG_DIR = join(process.env.HOME ?? '', '.ccc')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: CccConfig = {
  theme: 'dark',
  sidebarWidth: 260,
  favoriteFolders: [],
  sessionColors: {}
}

export class ConfigService {
  private config: CccConfig = { ...DEFAULT_CONFIG }

  load(): CccConfig {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }
      if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, 'utf-8')
        const parsed = JSON.parse(raw)
        this.config = {
          theme: parsed.theme ?? DEFAULT_CONFIG.theme,
          sidebarWidth: parsed.sidebarWidth ?? DEFAULT_CONFIG.sidebarWidth,
          favoriteFolders: Array.isArray(parsed.favoriteFolders) ? parsed.favoriteFolders : [],
          sessionColors: parsed.sessionColors && typeof parsed.sessionColors === 'object'
            ? parsed.sessionColors
            : {}
        }
      } else {
        this.config = { ...DEFAULT_CONFIG }
        this.save(this.config)
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
    return this.config
  }

  save(config: CccConfig): void {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
      this.config = config
    } catch (err) {
      console.error('Failed to save config:', err)
    }
  }

  update(partial: Partial<CccConfig>): CccConfig {
    if (partial.sessionColors) {
      this.config.sessionColors = { ...this.config.sessionColors, ...partial.sessionColors }
    }
    if (partial.theme !== undefined) this.config.theme = partial.theme
    if (partial.sidebarWidth !== undefined) this.config.sidebarWidth = partial.sidebarWidth
    if (partial.favoriteFolders !== undefined) this.config.favoriteFolders = partial.favoriteFolders

    this.save(this.config)
    return this.config
  }

  get(): CccConfig {
    return this.config
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/config-service.ts
git commit -m "Add ConfigService for ~/.ccc/config.json persistence"
```

---

### Task 3: Config IPC Handlers

**Files:**
- Create: `src/main/ipc/config.ts`

- [ ] **Step 1: Create config IPC handlers**

Write `src/main/ipc/config.ts`:

```typescript
import { ipcMain } from 'electron'
import type { ConfigService } from '../config-service'
import type { CccConfig } from '../../shared/types'

export function registerConfigIpc(configService: ConfigService): void {
  ipcMain.handle('config:load', () => {
    return configService.load()
  })

  ipcMain.handle('config:update', (_event, partial: Partial<CccConfig>) => {
    return configService.update(partial)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc/config.ts
git commit -m "Add config IPC handlers"
```

---

### Task 4: Wire ConfigService into Main Process

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/session-manager.ts`

- [ ] **Step 1: Update main index.ts**

Add imports and init ConfigService. In `src/main/index.ts`:

Add import at top:
```typescript
import { ConfigService } from './config-service'
import { registerConfigIpc } from './ipc/config'
```

Add after the existing manager instantiations (`const stateDetector = ...`):
```typescript
const configService = new ConfigService()
configService.load()
```

Pass configService to sessionManager — add after `const configService`:
```typescript
sessionManager.setConfigService(configService)
```

Add after the existing `registerTerminalIpc(...)` line:
```typescript
registerConfigIpc(configService)
```

- [ ] **Step 2: Add setConfigService to SessionManager**

In `src/main/session-manager.ts`, add a `configService` field and method:

Add field after `private colorIndex = 0`:
```typescript
  private configService: { get(): { sessionColors: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string> }>): void } | null = null
```

Add method after `checkDependencies`:
```typescript
  setConfigService(service: { get(): { sessionColors: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string> }>): void }): void {
    this.configService = service
  }
```

Update `nextColor()` to check config for existing color:
```typescript
  private getColorForSession(sessionName: string): string {
    const saved = this.configService?.get().sessionColors[sessionName]
    if (saved) return saved
    const color = SESSION_COLORS[this.colorIndex % SESSION_COLORS.length]
    this.colorIndex++
    return color
  }
```

Replace both calls to `this.nextColor()` with `this.getColorForSession(sessionName)`:

In `list()` method, change:
```typescript
        const color = this.nextColor()
```
to:
```typescript
        const color = this.getColorForSession(name.slice(PREFIX.length))
```

In `create()` method, change:
```typescript
    const color = this.nextColor()
```
to:
```typescript
    const color = this.getColorForSession(opts.name)
```

After creating a session in `create()`, persist the color. Add after `this.sessions.set(session.id, session)`:
```typescript
    this.configService?.update({ sessionColors: { [opts.name]: color } })
```

Remove the now-unused `nextColor()` method.

- [ ] **Step 3: Verify build**

```bash
npx electron-vite build
```

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/session-manager.ts
git commit -m "Wire ConfigService into main process and session manager"
```

---

### Task 5: Update Preload with Config API

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add config API to preload**

In `src/preload/index.ts`, add the config property to the `api` object, after the `state` property:

```typescript
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    update: (partial) => ipcRenderer.invoke('config:update', partial)
  }
```

Update the import to include `CccConfig`:
```typescript
import type { CccAPI, SessionCreate, SessionStatus, CccConfig } from '../shared/types'
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "Add config API to preload"
```

---

### Task 6: Update Session Store with Config

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add config state and actions to store**

In `src/renderer/stores/session-store.ts`:

Update import:
```typescript
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder } from '../../shared/types'
```

Add to the `SessionStore` interface:
```typescript
  settingsOpen: boolean
  favorites: FavoriteFolder[]

  loadConfig: () => Promise<void>
  toggleSettings: () => void
  setFavorites: (favorites: FavoriteFolder[]) => Promise<void>
```

Add to store initial state (after `loading: true`):
```typescript
  settingsOpen: false,
  favorites: [],
```

Add store actions:
```typescript
  loadConfig: async () => {
    const config = await window.cccAPI.config.load()
    document.documentElement.setAttribute('data-theme', config.theme)
    set({
      theme: config.theme,
      sidebarWidth: config.sidebarWidth,
      favorites: config.favoriteFolders
    })
  },

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setFavorites: async (favorites) => {
    await window.cccAPI.config.update({ favoriteFolders: favorites })
    set({ favorites })
  },
```

Update `toggleTheme` to persist:
```typescript
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    void window.cccAPI.config.update({ theme: next })
    return { theme: next }
  }),
```

Update `setSidebarWidth` to persist on set (debounced by caller):
```typescript
  setSidebarWidth: (width) => {
    const clamped = Math.max(180, Math.min(500, width))
    set({ sidebarWidth: clamped })
  },
```

Add a new action for persisting sidebar width (called on drag end):
```typescript
  persistSidebarWidth: async () => {
    const { sidebarWidth } = get()
    await window.cccAPI.config.update({ sidebarWidth })
  },
```

Add `persistSidebarWidth` to the interface:
```typescript
  persistSidebarWidth: () => Promise<void>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "Add config loading, favorites, settings state to session store"
```

---

### Task 7: Load Config on App Startup

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Add loadConfig call**

In `src/renderer/App.tsx`, add `loadConfig` to the destructured store values:

```typescript
  const loadConfig = useSessionStore((s) => s.loadConfig)
```

Add `loadConfig()` call before `loadSessions()` in the useEffect:

```typescript
  useEffect(() => {
    loadConfig().then(() => loadSessions())
    // ... rest unchanged
```

Add `loadConfig` to the dependency array.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "Load config before sessions on app startup"
```

---

### Task 8: Persist Sidebar Width on Drag End

**Files:**
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Call persistSidebarWidth on drag end**

In `src/renderer/components/Layout.tsx`, add to store selectors:
```typescript
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)
```

In `handleDragEnd` function, add after `document.body.style.userSelect = ''`:
```typescript
        void persistSidebarWidth()
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Layout.tsx
git commit -m "Persist sidebar width to config on drag end"
```

---

### Task 9: Settings Modal

**Files:**
- Create: `src/renderer/components/SettingsModal.tsx`
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Create SettingsModal**

Write `src/renderer/components/SettingsModal.tsx`:

```tsx
import { useState } from 'react'
import { X, Plus, Trash2, Star, Palette } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { FavoriteFolder } from '../../shared/types'

type Tab = 'favorites' | 'appearance'

export default function SettingsModal(): React.JSX.Element {
  const settingsOpen = useSessionStore((s) => s.settingsOpen)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const favorites = useSessionStore((s) => s.favorites)
  const setFavorites = useSessionStore((s) => s.setFavorites)
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)

  const [activeTab, setActiveTab] = useState<Tab>('favorites')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPath, setEditPath] = useState('')
  const [editBranch, setEditBranch] = useState('')

  if (!settingsOpen) return <></>

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleSettings()
  }

  const startAdd = (): void => {
    setEditingIndex(favorites.length)
    setEditName('')
    setEditPath('')
    setEditBranch('main')
  }

  const startEdit = (idx: number): void => {
    const fav = favorites[idx]
    setEditingIndex(idx)
    setEditName(fav.name)
    setEditPath(fav.path)
    setEditBranch(fav.defaultBranch)
  }

  const saveEdit = (): void => {
    if (!editName.trim() || !editPath.trim() || editingIndex === null) return
    const entry: FavoriteFolder = {
      name: editName.trim(),
      path: editPath.trim(),
      defaultBranch: editBranch.trim() || 'main'
    }
    const updated = [...favorites]
    if (editingIndex >= favorites.length) {
      updated.push(entry)
    } else {
      updated[editingIndex] = entry
    }
    void setFavorites(updated)
    setEditingIndex(null)
  }

  const cancelEdit = (): void => {
    setEditingIndex(null)
  }

  const deleteFavorite = (idx: number): void => {
    void setFavorites(favorites.filter((_, i) => i !== idx))
    if (editingIndex === idx) setEditingIndex(null)
  }

  const resetSidebarWidth = (): void => {
    setSidebarWidth(260)
    void persistSidebarWidth()
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'favorites', label: 'Favorites', icon: <Star size={12} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={12} /> }
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[560px] max-h-[80vh] rounded-xl border flex flex-col"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={toggleSettings}
            className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
              style={{
                backgroundColor: activeTab === tab.id ? 'var(--bg-raised)' : 'transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-5">
          {activeTab === 'favorites' && (
            <div className="flex flex-col gap-2">
              {favorites.map((fav, idx) => (
                <div key={idx}>
                  {editingIndex === idx ? (
                    <div
                      className="rounded-lg border p-3 flex flex-col gap-2"
                      style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        autoFocus
                        className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editPath}
                        onChange={(e) => setEditPath(e.target.value)}
                        placeholder="Path (e.g. ~/projects/my-app)"
                        className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <input
                        type="text"
                        value={editBranch}
                        onChange={(e) => setEditBranch(e.target.value)}
                        placeholder="Default branch (e.g. main)"
                        className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="px-3 py-1 rounded text-[10px] font-medium"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-lg border p-3 flex items-center gap-3 group"
                      style={{ borderColor: 'var(--bg-raised)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {fav.name}
                        </div>
                        <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {fav.path}
                          {fav.defaultBranch && (
                            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                              ({fav.defaultBranch})
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(idx)}
                        className="text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteFavorite(idx)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--error)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {editingIndex === favorites.length ? (
                <div
                  className="rounded-lg border p-3 flex flex-col gap-2"
                  style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-primary)' }}
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                    autoFocus
                    className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editPath}
                    onChange={(e) => setEditPath(e.target.value)}
                    placeholder="Path (e.g. ~/projects/my-app)"
                    className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    placeholder="Default branch (e.g. main)"
                    className="px-2.5 py-1.5 rounded text-xs border outline-none focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 rounded text-[10px] font-medium"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1 rounded text-[10px] font-medium"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startAdd}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed text-xs transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                >
                  <Plus size={12} />
                  Add Favorite
                </button>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Switch between dark and light mode</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { if (theme !== 'dark') toggleTheme() }}
                    className="px-3 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: theme === 'dark' ? 'var(--bg-raised)' : 'transparent',
                      color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => { if (theme !== 'light') toggleTheme() }}
                    className="px-3 py-1.5 rounded text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: theme === 'light' ? 'var(--bg-raised)' : 'transparent',
                      color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}
                  >
                    Light
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Sidebar Width</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Reset sidebar to default width</div>
                </div>
                <button
                  onClick={resetSidebarWidth}
                  className="px-3 py-1.5 rounded text-[10px] font-medium transition-colors"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                >
                  Reset to 260px
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add SettingsModal to Layout**

In `src/renderer/components/Layout.tsx`, add import:
```typescript
import SettingsModal from './SettingsModal'
```

Add `<SettingsModal />` after `<NewSessionModal />` (before closing `</div>`).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx src/renderer/components/Layout.tsx
git commit -m "Add SettingsModal with Favorites and Appearance tabs"
```

---

### Task 10: Wire Settings Button in Sidebar

**Files:**
- Modify: `src/renderer/components/SessionSidebar.tsx`

- [ ] **Step 1: Wire the settings gear button**

In `src/renderer/components/SessionSidebar.tsx`, add to store selectors:
```typescript
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
```

Add `onClick={toggleSettings}` to the Settings button (currently has no onClick):
```tsx
        <button
          onClick={toggleSettings}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Settings"
        >
          <Settings size={13} />
        </button>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SessionSidebar.tsx
git commit -m "Wire settings button to open SettingsModal"
```

---

### Task 11: Add Favorites to NewSessionModal

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add favorites list to modal**

In `src/renderer/components/NewSessionModal.tsx`:

Add to store selectors:
```typescript
  const favorites = useSessionStore((s) => s.favorites)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
```

Add favorites section before the form, after the header div. Insert between the header's closing `</div>` and `<form>`:

```tsx
        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Favorites
            </label>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((fav, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setName(fav.name)
                    setWorkingDirectory(fav.path)
                  }}
                  className="px-2.5 py-1.5 rounded-md text-[11px] border transition-colors duration-100 hover:border-[var(--accent)]"
                  style={{
                    borderColor: name === fav.name && workingDirectory === fav.path ? 'var(--accent)' : 'var(--bg-raised)',
                    backgroundColor: name === fav.name && workingDirectory === fav.path ? 'var(--accent-muted)' : 'var(--bg-primary)',
                    color: name === fav.name && workingDirectory === fav.path ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  {fav.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {favorites.length === 0 && (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => { toggleModal(); toggleSettings() }}
              className="text-[10px] transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Add favorite repos in Settings
            </button>
          </div>
        )}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx
git commit -m "Add favorites list to NewSessionModal"
```

---

### Task 12: Add Escape to Close Settings + Keyboard Shortcut

**Files:**
- Modify: `src/renderer/hooks/useKeyboard.ts`

- [ ] **Step 1: Add Escape handling for settings and Ctrl+, shortcut**

In `src/renderer/hooks/useKeyboard.ts`, update the Escape handler:

Change:
```typescript
      if (e.key === 'Escape') {
        const { modalOpen, toggleModal } = useSessionStore.getState()
        if (modalOpen) {
          e.preventDefault()
          toggleModal()
        }
        return
      }
```

To:
```typescript
      if (e.key === 'Escape') {
        const { modalOpen, toggleModal, settingsOpen, toggleSettings } = useSessionStore.getState()
        if (settingsOpen) {
          e.preventDefault()
          toggleSettings()
        } else if (modalOpen) {
          e.preventDefault()
          toggleModal()
        }
        return
      }
```

- [ ] **Step 2: Verify build**

```bash
npx electron-vite build
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/useKeyboard.ts
git commit -m "Add Escape to close settings modal"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Config types | types.ts |
| 2 | ConfigService | config-service.ts |
| 3 | Config IPC | ipc/config.ts |
| 4 | Wire into main | index.ts, session-manager.ts |
| 5 | Preload config API | preload/index.ts |
| 6 | Store config state | session-store.ts |
| 7 | Load config on startup | App.tsx |
| 8 | Persist sidebar width | Layout.tsx |
| 9 | Settings modal | SettingsModal.tsx |
| 10 | Wire settings button | SessionSidebar.tsx |
| 11 | Favorites in modal | NewSessionModal.tsx |
| 12 | Keyboard: Escape settings | useKeyboard.ts |
