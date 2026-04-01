---
title: Resizable Grid with Recursive Splits
date: 2026-04-01
status: approved
---

# Resizable Grid with Recursive Splits

Replace the current equal-sized CSS grid in GridView with a recursive split-tree layout (tmux model). Users drag dividers between sessions to resize them. Sessions can span into freed space when siblings are removed.

## Data Model

Layout is a binary tree. Each node is either a **leaf** (session) or a **split** (container with two children and a divider).

```typescript
// In shared/types.ts

type SplitDirection = 'horizontal' | 'vertical'

type SplitNode =
  | { type: 'leaf'; sessionId: string }
  | {
      type: 'split'
      direction: SplitDirection  // 'horizontal' = side by side, 'vertical' = stacked
      ratio: number              // 0.0–1.0, first child's share
      children: [SplitNode, SplitNode]
    }
```

Added to `CccConfig`:

```typescript
gridLayout?: SplitNode | null  // null = auto equal grid (default)
```

Example — 3 sessions, A large left, B+C stacked right:

```
{ type: 'split', direction: 'horizontal', ratio: 0.6,
  children: [
    { type: 'leaf', sessionId: 'A' },
    { type: 'split', direction: 'vertical', ratio: 0.5,
      children: [
        { type: 'leaf', sessionId: 'B' },
        { type: 'leaf', sessionId: 'C' }
      ] }
  ] }
```

## Rendering

Recursive React component (`SplitPane`) renders the tree:

- **leaf** → renders a GridCard with TerminalPanel (same header as current grid cards)
- **split** → renders a flex container (`row` for horizontal, `column` for vertical) with:
  - First child at `flex: ratio`
  - A `DragHandle` component
  - Second child at `flex: 1 - ratio`

All existing grid card visuals (status dot, name, type badge, double-click to single view) remain unchanged.

## Drag Handles

Each split node has a drag handle between its children.

- **Size:** 4px wide (horizontal split) or tall (vertical split)
- **Visual:** Transparent by default, accent color on hover
- **Cursor:** `col-resize` (horizontal) / `row-resize` (vertical)
- **Snap positions:** Ratio snaps to nearest step: 0.25, 0.33, 0.5, 0.66, 0.75
- **Min/max:** Ratio clamped to 0.15–0.85 (no pane under ~15%)
- **During drag:** `user-select: none` and `pointer-events: none` on terminals to prevent text selection
- **After drag:** All terminals in the tree call `fit()` to recalculate cols/rows
- **Implementation:** Same mousedown/mousemove/mouseup pattern as existing sidebar resize in Layout.tsx

## Auto Grid Builder

When `gridLayout` is `null`, build an equal split tree from visible sessions:

- 1 session → single leaf
- 2 sessions → horizontal split, ratio 0.5
- 3 sessions → horizontal split: left leaf + right vertical split (2 leaves)
- 4 sessions → horizontal split of two vertical splits (2×2)

This runs on mount and whenever gridLayout is null.

## Session Lifecycle

**New session created:**
- If `gridLayout` is null → build auto equal grid from all visible sessions
- Otherwise, find the largest leaf (by computed area) and split it, adding the new session as the second child
- Split direction alternates: if parent was horizontal → new split is vertical, and vice versa

**Session removed:**
- Find the leaf node for the removed session
- Replace the parent split node with the sibling node (sibling inherits all parent space)
- If the removed session was the only one (root is a leaf), set gridLayout to null

**Session excluded/included:**
- Excluding a session removes its leaf from the tree (same as removal)
- Including a session adds it back (same as creation)

**Reset layout:**
- Set gridLayout to null → auto equal grid rebuilds
- Accessible via a reset button in the grid toolbar

## Persistence

- `gridLayout` stored in `~/.ccc/config.json` alongside existing config
- Saved with 500ms debounce after drag events
- On load: validate that all sessionIds in the tree match active sessions. If any mismatch → fallback to null (auto grid)
- Uses existing `config.update()` IPC pattern

## Removed Features

- **Drag-to-reorder** in grid view is removed. Session order is determined by tree structure. Users rearrange by dragging dividers, not by dragging cards.

## Files Changed

- `src/shared/types.ts` — add SplitNode, SplitDirection types; add gridLayout to CccConfig
- `src/renderer/components/GridView.tsx` — rewrite to render split tree instead of flat CSS grid
- `src/renderer/components/SplitPane.tsx` — new recursive component
- `src/renderer/components/DragHandle.tsx` — new drag handle component
- `src/renderer/stores/session-store.ts` — add gridLayout state, actions for updateRatio, resetLayout
- `src/renderer/styles/index.css` — add drag handle styles, remove .grid-card.dragging/.drag-over
- `src/main/config-service.ts` — no changes needed (generic config persistence already handles arbitrary keys)
