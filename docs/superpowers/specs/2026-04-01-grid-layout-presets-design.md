# Grid Layout Presets

Configurable grid layout presets per session count (2-8), replacing the recursive binary split auto-layout with user-selectable predefined layouts.

## Current State

- `buildAutoGrid` in `split-tree.ts` uses recursive binary splitting that produces unpredictable layouts
- No user control over default grid arrangement
- Direction alternates by depth, which means 2 sessions stack vertically (unexpected)
- Grid has no cap on session count

## Design

### Config

New config key `gridPresets` stored in `~/.ccc/config.json`:

```ts
gridPresets: Record<string, string>
```

Maps session count (as string key) to preset ID. Example:

```json
{
  "gridPresets": {
    "2": "side-by-side",
    "3": "2top-1bottom",
    "4": "2x2",
    "5": "3top-2bottom",
    "6": "3x2",
    "7": "3top-4bottom",
    "8": "4x2"
  }
}
```

These are the defaults when no config exists.

### Preset Definitions

Each preset is a function that takes an array of session IDs and returns a `SplitNode`. Defined in `split-tree.ts` alongside the existing tree utilities.

**2 sessions:**
- `side-by-side` — horizontal split (left | right)
- `stacked` — vertical split (top / bottom)

**3 sessions:**
- `2top-1bottom` — top row: 2 side-by-side, bottom: 1 full width
- `1top-2bottom` — top: 1 full width, bottom row: 2 side-by-side
- `1left-2right` — left: 1 full height, right: 2 stacked
- `2left-1right` — left: 2 stacked, right: 1 full height
- `3cols` — 3 equal columns

**4 sessions:**
- `2x2` — 2 rows of 2
- `3top-1bottom` — top row: 3, bottom: 1 full width
- `1top-3bottom` — top: 1 full width, bottom row: 3
- `4cols` — 4 equal columns

**5 sessions:**
- `3top-2bottom` — top row: 3, bottom row: 2
- `2top-3bottom` — top row: 2, bottom row: 3

**6 sessions:**
- `3x2` — 2 rows of 3
- `2x3` — 3 rows of 2

**7 sessions:**
- `3top-4bottom` — top row: 3, bottom row: 4
- `4top-3bottom` — top row: 4, bottom row: 3

**8 sessions:**
- `4x2` — 2 rows of 4
- `3-3-2` — 3 rows: 3, 3, 2

### Settings UI

New "Grid" tab in settings sidebar under General group:

```
GENERAL
  Appearance
  Grid          ← new, icon: LayoutGrid
  Features
```

`GridSettings.tsx` renders a section per session count (2-8). Each section shows the available preset options as small visual thumbnails (CSS flexbox miniatures). The active preset has an accent-colored border. Clicking a thumbnail selects it and saves to config immediately.

### buildAutoGrid Changes

Replace the current recursive `buildAutoGridInner` with a preset-based builder:

1. Look up `gridPresets[count]` from config (via Zustand store)
2. If found, call the corresponding preset builder function
3. If not found (count > 8 or missing config), fall back to existing recursive algorithm
4. Cap grid display at 8 sessions — extra sessions beyond 8 are not shown in grid (same as excluded sessions)

The preset builder functions are pure: `(sessionIds: string[]) => SplitNode`. They construct the split tree that represents the chosen layout.

### Zustand Store

Add to session store:
- `gridPresets: Record<string, string>` — loaded from config on app start
- `setGridPresets(presets: Record<string, string>): void` — saves to config and updates store

### Discarded Changes

The current unstaged changes to GridView.tsx, SplitPane.tsx, and split-tree.ts are discarded — the direction fix and other tweaks are superseded by this feature.

## Out of Scope

- Custom/freeform grid builder
- Per-session-group layouts
- Animated transitions between layouts
- Keyboard shortcuts to cycle presets
