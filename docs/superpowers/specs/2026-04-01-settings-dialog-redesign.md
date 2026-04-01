# Settings Dialog Redesign

Replace the horizontal tab bar with a vertical sidebar navigation layout.

## Current State

- 1264-line monolithic `SettingsModal.tsx` with 8 horizontal tabs
- 20+ `useState` hooks, duplicated inline form patterns
- Inconsistent styling (some tabs use `--bg-tertiary`/`--border`, others use `--bg-raised`/`--bg-primary`)
- Fixed 560px width is cramped for content-heavy tabs

## Design

### Layout

- **Modal size:** 720px wide, 80vh tall (up from 560px)
- **Sidebar:** 180px fixed-width left panel with grouped navigation
- **Content panel:** Fills remaining width, scrolls independently
- **Close button:** Top-right of modal, same as current

### Sidebar Navigation

Grouped with subtle uppercase headers. Each item has a Lucide icon + label. Active item gets `--bg-raised` background and `--text-primary` color. Inactive items use `--text-muted`.

```
GENERAL
  Sun         Appearance
  Zap         Features

SESSIONS
  Monitor     AI Providers
  Folder      Favorites
  GitBranch   Worktrees

CONNECTIONS
  Server      Remote Hosts
  Box         Containers

SYSTEM
  Settings    Advanced
```

Lucide icons used: `Sun`, `Zap`, `Monitor`, `Folder`, `GitBranch`, `Server`, `Box`, `Settings` (the gear icon).

### Styling

All styling uses existing CSS variables:
- `--bg-surface` — modal background
- `--bg-primary` — content panel background  
- `--bg-raised` — sidebar active item, borders, input backgrounds
- `--text-primary`, `--text-secondary`, `--text-muted` — text hierarchy
- `--accent` — focus rings, save buttons
- `--modal-backdrop` — backdrop overlay

Fix the inconsistency in the Advanced tab — replace `--bg-tertiary` and `--border` references with the standard variables used elsewhere.

### Component Structure

Split the monolith into focused files:

```
components/settings/
  SettingsModal.tsx        — modal shell, sidebar nav, active tab routing
  SettingsSidebar.tsx      — sidebar navigation component
  AppearanceSettings.tsx   — theme, zoom, sidebar width
  FeaturesSettings.tsx     — feature flags, PR config
  ProvidersSettings.tsx    — AI provider enable/disable
  FavoritesSettings.tsx    — favorite folders CRUD
  WorktreesSettings.tsx    — worktree base path, sync paths
  RemotesSettings.tsx      — remote hosts + nested favorites CRUD
  ContainersSettings.tsx   — container CRUD
  AdvancedSettings.tsx     — IDE command, notifications, skip permissions, config routing
```

Each tab component receives no props — it reads from Zustand directly (matching the current pattern). This keeps the interface clean and avoids prop drilling.

### Behavior

- No functional changes — same settings, same save behavior
- Tab state managed by `useState<Tab>` in `SettingsModal.tsx` (same as current)
- Sidebar nav items are buttons with `onClick={() => setTab(...)}`
- Content panel renders the active tab component
- Modal open/close animation preserved (`modal-enter 150ms ease`)

## Out of Scope

- Search/filter within settings
- Keyboard navigation between sidebar items
- Settings categories reordering
- New settings or features
