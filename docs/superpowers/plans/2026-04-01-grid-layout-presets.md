# Grid Layout Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable grid layout presets per session count (2-8) with visual picker in settings, replacing the recursive binary split auto-layout.

**Architecture:** Define preset builder functions in `split-tree.ts` that map preset IDs to `SplitNode` trees. Store selected preset per count in config (`gridPresets`). Add a `GridSettings.tsx` component with visual thumbnails for selection. Update `buildAutoGrid` to use the stored preset. Add `grid` tab to settings sidebar.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Lucide React (`LayoutGrid`), Zustand

---

### Task 1: Discard unstaged grid changes and add gridPresets to types/config

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/stores/session-store.ts`
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Discard unstaged changes**

```bash
git checkout -- src/renderer/components/GridView.tsx src/renderer/components/SplitPane.tsx src/renderer/lib/split-tree.ts
```

- [ ] **Step 2: Add gridPresets to CccConfig**

In `src/shared/types.ts`, add `gridPresets` to the `CccConfig` interface, after the `gridLayout` field:

```ts
  gridLayout?: SplitNode | null
  gridPresets?: Record<string, string>
```

- [ ] **Step 3: Add gridPresets to Zustand store**

In `src/renderer/stores/session-store.ts`, add to the store state (find where `gridLayout` is defined and add nearby):

Add to the state interface area:
```ts
  gridPresets: Record<string, string>
  setGridPresets: (presets: Record<string, string>) => void
```

Add default value in the initial state (near `gridLayout: null`):
```ts
  gridPresets: {},
```

Add the setter (near `setGridLayout`):
```ts
  setGridPresets: (presets) => {
    set({ gridPresets: presets })
    void window.cccAPI.config.update({ gridPresets: presets })
  },
```

In `loadConfig`, add gridPresets loading (near `gridLayout: config.gridLayout ?? null`):
```ts
  gridPresets: config.gridPresets ?? {},
```

- [ ] **Step 4: Add gridPresets default to config-service**

In `src/main/config-service.ts`, find where defaults are defined and add:
```ts
  gridPresets: {},
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/stores/session-store.ts src/main/config-service.ts src/renderer/components/GridView.tsx src/renderer/components/SplitPane.tsx src/renderer/lib/split-tree.ts
git commit -m "feat(grid): add gridPresets to config and store"
```

---

### Task 2: Add preset builder functions to split-tree.ts

**Files:**
- Modify: `src/renderer/lib/split-tree.ts`

- [ ] **Step 1: Add preset definitions and builder**

Add the following to the end of `src/renderer/lib/split-tree.ts` (after the existing `updateRatio` function):

```ts
/**
 * Default preset for each session count.
 */
export const DEFAULT_GRID_PRESETS: Record<string, string> = {
  '2': 'side-by-side',
  '3': '2top-1bottom',
  '4': '2x2',
  '5': '3top-2bottom',
  '6': '3x2',
  '7': '3top-4bottom',
  '8': '4x2',
}

/**
 * Available preset IDs per session count.
 */
export const GRID_PRESET_OPTIONS: Record<number, string[]> = {
  2: ['side-by-side', 'stacked'],
  3: ['2top-1bottom', '1top-2bottom', '1left-2right', '2left-1right', '3cols'],
  4: ['2x2', '3top-1bottom', '1top-3bottom', '4cols'],
  5: ['3top-2bottom', '2top-3bottom'],
  6: ['3x2', '2x3'],
  7: ['3top-4bottom', '4top-3bottom'],
  8: ['4x2', '3-3-2'],
}

/**
 * Human-readable labels for preset IDs.
 */
export const GRID_PRESET_LABELS: Record<string, string> = {
  'side-by-side': 'Side by side',
  'stacked': 'Stacked',
  '2top-1bottom': '2 top + 1 bottom',
  '1top-2bottom': '1 top + 2 bottom',
  '1left-2right': '1 left + 2 right',
  '2left-1right': '2 left + 1 right',
  '3cols': '3 columns',
  '2x2': '2×2 grid',
  '3top-1bottom': '3 top + 1 bottom',
  '1top-3bottom': '1 top + 3 bottom',
  '4cols': '4 columns',
  '3top-2bottom': '3 top + 2 bottom',
  '2top-3bottom': '2 top + 3 bottom',
  '3x2': '3×2 grid',
  '2x3': '2×3 grid',
  '3top-4bottom': '3 top + 4 bottom',
  '4top-3bottom': '4 top + 3 bottom',
  '4x2': '4×2 grid',
  '3-3-2': '3 + 3 + 2 rows',
}

/** Helper: horizontal split (side by side) */
function hSplit(left: SplitNode, right: SplitNode, ratio = 0.5): SplitNode {
  return { type: 'split', direction: 'horizontal', ratio, children: [left, right] }
}

/** Helper: vertical split (top/bottom) */
function vSplit(top: SplitNode, bottom: SplitNode, ratio = 0.5): SplitNode {
  return { type: 'split', direction: 'vertical', ratio, children: [top, bottom] }
}

/** Helper: leaf node */
function leaf(id: string): SplitNode {
  return { type: 'leaf', sessionId: id }
}

/** Helper: build a row of N equal leaves (horizontal splits) */
function hRow(ids: string[]): SplitNode {
  if (ids.length === 1) return leaf(ids[0])
  if (ids.length === 2) return hSplit(leaf(ids[0]), leaf(ids[1]))
  // Split first from rest, with ratio = 1/N
  return hSplit(leaf(ids[0]), hRow(ids.slice(1)), 1 / ids.length)
}

/** Helper: build a column of N equal leaves (vertical splits) */
function vCol(ids: string[]): SplitNode {
  if (ids.length === 1) return leaf(ids[0])
  if (ids.length === 2) return vSplit(leaf(ids[0]), leaf(ids[1]))
  return vSplit(leaf(ids[0]), vCol(ids.slice(1)), 1 / ids.length)
}

/**
 * Build a split tree from a preset ID and session IDs.
 * Returns null if preset is unknown or session count doesn't match.
 */
export function buildPresetGrid(presetId: string, sessionIds: string[]): SplitNode | null {
  const s = sessionIds
  switch (presetId) {
    // 2 sessions
    case 'side-by-side':
      if (s.length !== 2) return null
      return hSplit(leaf(s[0]), leaf(s[1]))
    case 'stacked':
      if (s.length !== 2) return null
      return vSplit(leaf(s[0]), leaf(s[1]))

    // 3 sessions
    case '2top-1bottom':
      if (s.length !== 3) return null
      return vSplit(hSplit(leaf(s[0]), leaf(s[1])), leaf(s[2]))
    case '1top-2bottom':
      if (s.length !== 3) return null
      return vSplit(leaf(s[0]), hSplit(leaf(s[1]), leaf(s[2])))
    case '1left-2right':
      if (s.length !== 3) return null
      return hSplit(leaf(s[0]), vSplit(leaf(s[1]), leaf(s[2])))
    case '2left-1right':
      if (s.length !== 3) return null
      return hSplit(vSplit(leaf(s[0]), leaf(s[1])), leaf(s[2]))
    case '3cols':
      if (s.length !== 3) return null
      return hSplit(leaf(s[0]), hSplit(leaf(s[1]), leaf(s[2])), 1 / 3)

    // 4 sessions
    case '2x2':
      if (s.length !== 4) return null
      return vSplit(hSplit(leaf(s[0]), leaf(s[1])), hSplit(leaf(s[2]), leaf(s[3])))
    case '3top-1bottom':
      if (s.length !== 4) return null
      return vSplit(hRow(s.slice(0, 3)), leaf(s[3]))
    case '1top-3bottom':
      if (s.length !== 4) return null
      return vSplit(leaf(s[0]), hRow(s.slice(1)))
    case '4cols':
      if (s.length !== 4) return null
      return hSplit(hSplit(leaf(s[0]), leaf(s[1])), hSplit(leaf(s[2]), leaf(s[3])))

    // 5 sessions
    case '3top-2bottom':
      if (s.length !== 5) return null
      return vSplit(hRow(s.slice(0, 3)), hSplit(leaf(s[3]), leaf(s[4])))
    case '2top-3bottom':
      if (s.length !== 5) return null
      return vSplit(hSplit(leaf(s[0]), leaf(s[1])), hRow(s.slice(2)))

    // 6 sessions
    case '3x2':
      if (s.length !== 6) return null
      return vSplit(hRow(s.slice(0, 3)), hRow(s.slice(3)))
    case '2x3':
      if (s.length !== 6) return null
      return hSplit(vCol(s.slice(0, 3)), vCol(s.slice(3)))

    // 7 sessions
    case '3top-4bottom':
      if (s.length !== 7) return null
      return vSplit(hRow(s.slice(0, 3)), hSplit(hSplit(leaf(s[3]), leaf(s[4])), hSplit(leaf(s[5]), leaf(s[6]))))
    case '4top-3bottom':
      if (s.length !== 7) return null
      return vSplit(hSplit(hSplit(leaf(s[0]), leaf(s[1])), hSplit(leaf(s[2]), leaf(s[3]))), hRow(s.slice(4)))

    // 8 sessions
    case '4x2':
      if (s.length !== 8) return null
      return vSplit(
        hSplit(hSplit(leaf(s[0]), leaf(s[1])), hSplit(leaf(s[2]), leaf(s[3]))),
        hSplit(hSplit(leaf(s[4]), leaf(s[5])), hSplit(leaf(s[6]), leaf(s[7])))
      )
    case '3-3-2':
      if (s.length !== 8) return null
      return vSplit(
        hRow(s.slice(0, 3)),
        vSplit(hRow(s.slice(3, 6)), hSplit(leaf(s[6]), leaf(s[7])))
      )

    default:
      return null
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/split-tree.ts
git commit -m "feat(grid): add preset builder functions for 2-8 session layouts"
```

---

### Task 3: Update buildAutoGrid to use presets

**Files:**
- Modify: `src/renderer/lib/split-tree.ts`
- Modify: `src/renderer/components/GridView.tsx`

- [ ] **Step 1: Change buildAutoGrid signature to accept presets**

In `src/renderer/lib/split-tree.ts`, replace the existing `buildAutoGrid` function (lines 22-24) with:

```ts
/**
 * Build a grid layout from presets config, falling back to recursive split.
 */
export function buildAutoGrid(sessionIds: string[], presets?: Record<string, string>): SplitNode | null {
  if (sessionIds.length === 0) return null
  if (sessionIds.length === 1) return { type: 'leaf', sessionId: sessionIds[0] }

  const count = String(sessionIds.length)
  const presetId = presets?.[count] ?? DEFAULT_GRID_PRESETS[count]
  if (presetId) {
    const result = buildPresetGrid(presetId, sessionIds)
    if (result) return result
  }

  // Fallback for counts > 8 or unknown presets
  return buildAutoGridInner(sessionIds, 0)
}
```

- [ ] **Step 2: Update GridView to pass presets to buildAutoGrid**

In `src/renderer/components/GridView.tsx`, add `gridPresets` to the store reads (after the `resetGridLayout` line):

```ts
  const gridPresets = useSessionStore((s) => s.gridPresets)
```

Then update the two places that call `buildAutoGrid` to pass presets:

Line ~34 (the `gridLayout === null` case):
```ts
      setGridLayout(buildAutoGrid(visibleSessions.map((s) => s.id), gridPresets))
```

Also add `gridPresets` to the useEffect dependency array.

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/lib/split-tree.ts src/renderer/components/GridView.tsx
git commit -m "feat(grid): use preset config in buildAutoGrid"
```

---

### Task 4: Create GridSettings component

**Files:**
- Create: `src/renderer/components/settings/GridSettings.tsx`

- [ ] **Step 1: Write GridSettings component**

Create `src/renderer/components/settings/GridSettings.tsx`:

```tsx
import { useSessionStore } from '../../stores/session-store'
import {
  DEFAULT_GRID_PRESETS,
  GRID_PRESET_OPTIONS,
  GRID_PRESET_LABELS,
} from '../../lib/split-tree'

/** Miniature layout thumbnails rendered as nested flex divs */
function PresetThumbnail({ presetId }: { presetId: string }): React.JSX.Element {
  const layout = PRESET_LAYOUTS[presetId]
  if (!layout) return <div />

  return (
    <div className="w-full h-full flex gap-[2px]" style={{ flexDirection: layout.dir === 'v' ? 'column' : 'row' }}>
      {layout.rows.map((row, i) => (
        <div key={i} className="flex gap-[2px] flex-1 min-h-0 min-w-0" style={{ flexDirection: row.dir === 'h' ? 'row' : 'column' }}>
          {Array.from({ length: row.count }).map((_, j) => (
            <div key={j} className="flex-1 rounded-[2px] min-h-0 min-w-0" style={{ backgroundColor: 'var(--bg-raised)' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

interface RowDef {
  count: number
  dir: 'h' | 'v'
}

interface LayoutDef {
  dir: 'v' | 'h'
  rows: RowDef[]
}

const PRESET_LAYOUTS: Record<string, LayoutDef> = {
  'side-by-side': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  'stacked': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '2top-1bottom': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 1, dir: 'h' }] },
  '1top-2bottom': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 2, dir: 'h' }] },
  '1left-2right': { dir: 'h', rows: [{ count: 1, dir: 'v' }, { count: 2, dir: 'v' }] },
  '2left-1right': { dir: 'h', rows: [{ count: 2, dir: 'v' }, { count: 1, dir: 'v' }] },
  '3cols': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '2x2': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 2, dir: 'h' }] },
  '3top-1bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 1, dir: 'h' }] },
  '1top-3bottom': { dir: 'v', rows: [{ count: 1, dir: 'h' }, { count: 3, dir: 'h' }] },
  '4cols': { dir: 'h', rows: [{ count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }, { count: 1, dir: 'h' }] },
  '3top-2bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 2, dir: 'h' }] },
  '2top-3bottom': { dir: 'v', rows: [{ count: 2, dir: 'h' }, { count: 3, dir: 'h' }] },
  '3x2': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 3, dir: 'h' }] },
  '2x3': { dir: 'h', rows: [{ count: 3, dir: 'v' }, { count: 3, dir: 'v' }] },
  '3top-4bottom': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 4, dir: 'h' }] },
  '4top-3bottom': { dir: 'v', rows: [{ count: 4, dir: 'h' }, { count: 3, dir: 'h' }] },
  '4x2': { dir: 'v', rows: [{ count: 4, dir: 'h' }, { count: 4, dir: 'h' }] },
  '3-3-2': { dir: 'v', rows: [{ count: 3, dir: 'h' }, { count: 3, dir: 'h' }, { count: 2, dir: 'h' }] },
}

export default function GridSettings(): React.JSX.Element {
  const gridPresets = useSessionStore((s) => s.gridPresets)
  const setGridPresets = useSessionStore((s) => s.setGridPresets)
  const resetGridLayout = useSessionStore((s) => s.resetGridLayout)

  const getActivePreset = (count: number): string => {
    return gridPresets[String(count)] ?? DEFAULT_GRID_PRESETS[String(count)] ?? ''
  }

  const selectPreset = (count: number, presetId: string): void => {
    const updated = { ...DEFAULT_GRID_PRESETS, ...gridPresets, [String(count)]: presetId }
    setGridPresets(updated)
    // Reset current grid so it rebuilds with new preset
    resetGridLayout()
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Choose the default layout for each session count. Drag-resizing in the grid overrides these defaults until you reset.
      </p>
      {[2, 3, 4, 5, 6, 7, 8].map((count) => {
        const options = GRID_PRESET_OPTIONS[count] ?? []
        const active = getActivePreset(count)
        return (
          <div key={count}>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {count} Sessions
            </div>
            <div className="flex gap-2 flex-wrap">
              {options.map((presetId) => {
                const isActive = active === presetId
                return (
                  <button
                    key={presetId}
                    onClick={() => selectPreset(count, presetId)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className="w-[80px] h-[52px] rounded-md border-2 p-1.5 transition-colors duration-100"
                      style={{
                        borderColor: isActive ? 'var(--accent)' : 'var(--bg-raised)',
                        backgroundColor: 'var(--bg-primary)',
                      }}
                    >
                      <PresetThumbnail presetId={presetId} />
                    </div>
                    <span
                      className="text-[9px]"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {GRID_PRESET_LABELS[presetId] ?? presetId}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings/GridSettings.tsx
git commit -m "feat(settings): add GridSettings component with visual preset picker"
```

---

### Task 5: Add Grid tab to settings sidebar and modal

**Files:**
- Modify: `src/renderer/components/settings/SettingsSidebar.tsx`
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add grid tab to SettingsSidebar**

In `src/renderer/components/settings/SettingsSidebar.tsx`:

Update the import to include `LayoutGrid`:
```ts
import { Sun, Zap, LayoutGrid, Monitor, Folder, GitBranch, Server, Box, Settings } from 'lucide-react'
```

Update the Tab type to include `grid`:
```ts
export type Tab = 'appearance' | 'grid' | 'features' | 'providers' | 'favorites' | 'worktrees' | 'remotes' | 'containers' | 'advanced'
```

Add the Grid item to the General group (between Appearance and Features):
```ts
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Sun },
      { id: 'grid', label: 'Grid', icon: LayoutGrid },
      { id: 'features', label: 'Features', icon: Zap },
    ],
  },
```

- [ ] **Step 2: Add Grid tab to SettingsModal**

In `src/renderer/components/SettingsModal.tsx`:

Add the import:
```ts
import GridSettings from './settings/GridSettings'
```

Add to `TAB_TITLES`:
```ts
  grid: 'Grid',
```

Add to `TAB_COMPONENTS`:
```ts
  grid: GridSettings,
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/SettingsSidebar.tsx src/renderer/components/SettingsModal.tsx
git commit -m "feat(settings): add Grid tab to settings sidebar"
```

---

### Task 6: Final verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors

- [ ] **Step 2: Verify no stale references**

Search for any remaining references to the old `buildAutoGrid` signature (without presets parameter):
```bash
grep -rn "buildAutoGrid(" src/renderer/ --include="*.ts" --include="*.tsx"
```
Expected: all calls pass `gridPresets` as second arg (except the definition itself)

- [ ] **Step 3: Test manually**

Run: `pnpm dev`

Verify:
- Settings > Grid tab shows all preset options for counts 2-8
- Clicking a preset highlights it with accent border
- Opening grid view with N sessions uses the selected preset layout
- Reset grid layout button rebuilds with current preset
- Presets persist across app restart

- [ ] **Step 4: Commit any fixes**

```bash
git add -A src/
git commit -m "chore(grid): final verification and fixes"
```
