# CCC2 Config, Settings & Favorites — Design Spec

## Overview

Persist user preferences to `~/.ccc/config.json`, add a settings modal for managing favorites and appearance, and integrate favorites into the session creation flow. Auto-save on every change — no manual save button.

## Config File

### Location
`~/.ccc/config.json` — same as CCC1 for migration compatibility.

### Schema

```json
{
  "theme": "dark",
  "sidebarWidth": 260,
  "favoriteFolders": [
    {
      "name": "Core",
      "path": "~/Dev/Wint/Core",
      "defaultBranch": "main"
    },
    {
      "name": "Frontend",
      "path": "~/Dev/Wint/Frontend",
      "defaultBranch": "develop"
    }
  ],
  "sessionColors": {
    "api-server": "#88a1bb",
    "frontend": "#b7bd73"
  }
}
```

### TypeScript Types

```typescript
// shared/types.ts additions

interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
}

interface CccConfig {
  theme: Theme
  sidebarWidth: number
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
}
```

## ConfigService (Main Process)

`src/main/config-service.ts` — reads/writes `~/.ccc/config.json`.

```typescript
class ConfigService {
  load(): CccConfig           // Read from disk, return defaults if missing
  save(config: CccConfig): void  // Write to disk
  update(partial: Partial<CccConfig>): CccConfig  // Merge + save + return
}
```

- Creates `~/.ccc/` directory if it doesn't exist
- Returns sensible defaults if file is missing or corrupt
- Merges partial updates (deep merge for `sessionColors`, replace for arrays)
- Tilde expansion on `favoriteFolders[].path` when used (not when stored)

### Default Config

```typescript
{
  theme: 'dark',
  sidebarWidth: 260,
  favoriteFolders: [],
  sessionColors: {}
}
```

## IPC

```typescript
// New IPC channels
'config:load' () → CccConfig              // ipcMain.handle
'config:update' (partial: Partial<CccConfig>) → CccConfig  // ipcMain.handle
```

### Preload Addition

```typescript
// Add to CccAPI
config: {
  load: () => Promise<CccConfig>
  update: (partial: Partial<CccConfig>) => Promise<CccConfig>
}
```

## Integration Points

### App Startup

1. Main process loads config on startup
2. Renderer fetches config via `config:load` in App.tsx useEffect
3. Apply theme from config (set `data-theme` attribute)
4. Apply sidebarWidth from config
5. Session colors from config used when discovering existing tmux sessions (instead of auto-assigning new colors every time)

### Session Colors Persistence

When a session gets a color (auto-assigned or from config):
- Store `sessionColors[session.name] = color` in config
- On session discovery (list), check `config.sessionColors[name]` first before auto-assigning
- This means sessions keep their color across app restarts

### Theme Persistence

When user toggles theme:
- Update store (existing behavior)
- Also call `config:update({ theme: newTheme })`

### Sidebar Width Persistence

When user finishes dragging sidebar:
- On drag end, call `config:update({ sidebarWidth })` (debounced, only on mouseup)

## NewSessionModal — Favorites Integration

### Layout Change

When favorites exist:
```
┌──────────────────────────────────┐
│  New Session                   X │
│                                  │
│  FAVORITES                       │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │ Core │ │ FE   │ │ Docs │    │
│  │ ~/..  │ │ ~/..  │ │ ~/..  │    │
│  └──────┘ └──────┘ └──────┘    │
│                                  │
│  ─── or create manually ───     │
│                                  │
│  Type: [Claude] [Shell]          │
│  Name: [____________]           │
│  Dir:  [____________]           │
│                                  │
│  [Cancel]  [Create]             │
└──────────────────────────────────┘
```

When no favorites:
```
┌──────────────────────────────────┐
│  New Session                   X │
│                                  │
│  Type: [Claude] [Shell]          │
│  Name: [____________]           │
│  Dir:  [____________]           │
│                                  │
│  Add favorite repos in Settings  │
│                                  │
│  [Cancel]  [Create]             │
└──────────────────────────────────┘
```

### Favorite Click Behavior

1. Click favorite → `name` = favorite.name, `workingDirectory` = favorite.path
2. Session type stays as currently selected (Claude/Shell)
3. User can still edit name/dir before creating
4. Click Create as normal

## Settings Modal

Opened via gear icon in sidebar header. `Escape` or backdrop click closes.

### Component: `src/renderer/components/SettingsModal.tsx`

Tabs along the top:

**Tab 1: Favorites**
- List of favorite folders, each showing name, path, defaultBranch
- "Add Favorite" button at bottom
- Each favorite has edit (inline) and delete (trash icon) buttons
- Add/edit form: name input, path input, defaultBranch input
- Changes auto-saved via `config:update`

**Tab 2: Appearance**
- Theme toggle: Dark / Light (same as titlebar toggle, but more discoverable)
- Sidebar width: reset to default (260px) button

### Styling

Same visual language as NewSessionModal — dark surface, raised borders, amber accent. Wider (560px) to accommodate the favorites list.

## File Map

```
src/
├── main/
│   ├── config-service.ts          # New: read/write ~/.ccc/config.json
│   └── ipc/
│       └── config.ts              # New: config IPC handlers
├── preload/
│   └── index.ts                   # Modified: add config API
├── renderer/
│   ├── components/
│   │   ├── SettingsModal.tsx       # New: settings with tabs
│   │   └── NewSessionModal.tsx     # Modified: favorites integration
│   └── stores/
│       └── session-store.ts       # Modified: load config, persist theme/width
└── shared/
    └── types.ts                   # Modified: add FavoriteFolder, CccConfig
```

Also modified:
- `src/main/index.ts` — init ConfigService, pass to managers
- `src/main/session-manager.ts` — use config for session colors
- `src/renderer/App.tsx` — load config on startup
- `src/renderer/components/Layout.tsx` — persist sidebar width on drag end
- `src/renderer/components/SessionSidebar.tsx` — wire settings button

## What's NOT in Scope

- Keybinding customization
- Notifications config
- IDE command config
- Skip permissions config
- Claude config routing
- Remote host config (sub-project 3)
- Worktree base path (sub-project 4)
