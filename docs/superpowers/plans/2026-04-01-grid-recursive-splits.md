# Grid Recursive Splits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the equal-sized CSS grid in GridView with a recursive split-tree layout where users drag dividers between sessions to resize them.

**Architecture:** Layout state is a binary tree (`SplitNode`) where each node is either a leaf (session) or a split (two children + direction + ratio). A recursive `SplitPane` component renders the tree using nested flexbox. Drag handles between split children update the ratio with snap positions.

**Tech Stack:** React 19, TypeScript, Zustand, xterm.js (existing), CSS flexbox for layout

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types.ts` | Modify | Add `SplitDirection`, `SplitNode` types; add `gridLayout` to `CccConfig` |
| `src/renderer/lib/split-tree.ts` | Create | Pure functions for tree manipulation (build, add, remove, validate, snap) |
| `src/renderer/components/DragHandle.tsx` | Create | Draggable divider between split panes |
| `src/renderer/components/SplitPane.tsx` | Create | Recursive component rendering the split tree |
| `src/renderer/components/GridView.tsx` | Modify | Replace CSS grid with SplitPane tree rendering |
| `src/renderer/stores/session-store.ts` | Modify | Add `gridLayout` state, `updateSplitRatio`, `resetGridLayout`, `persistGridLayout` actions |
| `src/main/config-service.ts` | Modify | Add `gridLayout` to config load/update |
| `src/renderer/styles/index.css` | Modify | Add drag handle styles, remove drag-over/dragging styles |

---

### Task 1: Add Types

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add SplitNode types to shared/types.ts**

Add after the `ViewMode` type definition (line 34):

```typescript
export type SplitDirection = 'horizontal' | 'vertical'

export type SplitNode =
  | { type: 'leaf'; sessionId: string }
  | {
      type: 'split'
      direction: SplitDirection
      ratio: number
      children: [SplitNode, SplitNode]
    }
```

- [ ] **Step 2: Add gridLayout to CccConfig**

Add to the `CccConfig` interface, after `containerSessions`:

```typescript
gridLayout?: SplitNode | null
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (new types are additive, nothing uses them yet)

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(grid): add SplitNode and SplitDirection types"
```

---

### Task 2: Split Tree Utility Functions

**Files:**
- Create: `src/renderer/lib/split-tree.ts`

This file contains all pure logic for manipulating the split tree. No React, no store — just data in, data out.

- [ ] **Step 1: Create split-tree.ts with all utility functions**

```typescript
import type { SplitNode, SplitDirection } from '../../shared/types'

const SNAP_POSITIONS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75]
const MIN_RATIO = 0.15
const MAX_RATIO = 0.85

/**
 * Snap a ratio to the nearest snap position if within threshold.
 */
export function snapRatio(ratio: number, threshold = 0.04): number {
  const clamped = Math.max(MIN_RATIO, Math.min(MAX_RATIO, ratio))
  for (const snap of SNAP_POSITIONS) {
    if (Math.abs(clamped - snap) < threshold) return snap
  }
  return clamped
}

/**
 * Build an auto equal-split tree from a list of session IDs.
 * Returns null if no sessions.
 */
export function buildAutoGrid(sessionIds: string[]): SplitNode | null {
  if (sessionIds.length === 0) return null
  if (sessionIds.length === 1) return { type: 'leaf', sessionId: sessionIds[0] }
  if (sessionIds.length === 2) {
    return {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      children: [
        { type: 'leaf', sessionId: sessionIds[0] },
        { type: 'leaf', sessionId: sessionIds[1] }
      ]
    }
  }
  if (sessionIds.length === 3) {
    return {
      type: 'split',
      direction: 'horizontal',
      ratio: 0.5,
      children: [
        { type: 'leaf', sessionId: sessionIds[0] },
        {
          type: 'split',
          direction: 'vertical',
          ratio: 0.5,
          children: [
            { type: 'leaf', sessionId: sessionIds[1] },
            { type: 'leaf', sessionId: sessionIds[2] }
          ]
        }
      ]
    }
  }
  // 4+ sessions: split in half recursively
  const mid = Math.ceil(sessionIds.length / 2)
  const left = sessionIds.slice(0, mid)
  const right = sessionIds.slice(mid)
  return {
    type: 'split',
    direction: 'horizontal',
    ratio: 0.5,
    children: [
      buildAutoGrid(left)!,
      buildAutoGrid(right)!
    ]
  }
}

/**
 * Collect all session IDs from the tree.
 */
export function collectSessionIds(node: SplitNode): string[] {
  if (node.type === 'leaf') return [node.sessionId]
  return [...collectSessionIds(node.children[0]), ...collectSessionIds(node.children[1])]
}

/**
 * Validate that all sessionIds in the tree exist in the provided set.
 * Returns true if valid.
 */
export function validateTree(node: SplitNode, validIds: Set<string>): boolean {
  const ids = collectSessionIds(node)
  return ids.every((id) => validIds.has(id))
}

/**
 * Remove a session from the tree. Returns the new tree root, or null if empty.
 * When a leaf is removed, its sibling takes the parent's place.
 */
export function removeSession(node: SplitNode, sessionId: string): SplitNode | null {
  if (node.type === 'leaf') {
    return node.sessionId === sessionId ? null : node
  }

  const [left, right] = node.children

  // Check if either direct child is the target leaf
  if (left.type === 'leaf' && left.sessionId === sessionId) return right
  if (right.type === 'leaf' && right.sessionId === sessionId) return left

  // Recurse into children
  const newLeft = removeSession(left, sessionId)
  const newRight = removeSession(right, sessionId)

  if (newLeft === null) return newRight
  if (newRight === null) return newLeft

  return { ...node, children: [newLeft, newRight] }
}

/**
 * Find the direction of the deepest split containing a leaf, to alternate.
 * Returns the opposite direction for the new split.
 */
function findParentDirection(node: SplitNode, sessionId: string): SplitDirection | null {
  if (node.type === 'leaf') return null
  for (const child of node.children) {
    if (child.type === 'leaf' && child.sessionId === sessionId) return node.direction
    const found = findParentDirection(child, sessionId)
    if (found !== null) return found
  }
  return null
}

/**
 * Add a session to the tree by splitting the largest leaf.
 * Uses a simple heuristic: first leaf found at the shallowest depth (leftmost, largest in balanced tree).
 */
export function addSession(node: SplitNode, newSessionId: string): SplitNode {
  // Find the first (shallowest) leaf to split
  const targetId = findShallowestLeaf(node)
  if (!targetId) return node

  const parentDir = findParentDirection(node, targetId)
  const newDirection: SplitDirection = parentDir === 'horizontal' ? 'vertical' : 'horizontal'

  return replaceLeaf(node, targetId, {
    type: 'split',
    direction: newDirection,
    ratio: 0.5,
    children: [
      { type: 'leaf', sessionId: targetId },
      { type: 'leaf', sessionId: newSessionId }
    ]
  })
}

function findShallowestLeaf(node: SplitNode): string | null {
  if (node.type === 'leaf') return node.sessionId
  // BFS-like: check direct children first
  const [left, right] = node.children
  if (left.type === 'leaf') return left.sessionId
  if (right.type === 'leaf') return right.sessionId
  return findShallowestLeaf(left) ?? findShallowestLeaf(right)
}

function replaceLeaf(node: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
  if (node.type === 'leaf') {
    return node.sessionId === targetId ? replacement : node
  }
  return {
    ...node,
    children: [
      replaceLeaf(node.children[0], targetId, replacement),
      replaceLeaf(node.children[1], targetId, replacement)
    ]
  }
}

/**
 * Update the ratio of a specific split node identified by path.
 * Path is an array of 0|1 indices from root to the target split.
 */
export function updateRatio(node: SplitNode, path: number[], newRatio: number): SplitNode {
  if (node.type === 'leaf') return node
  if (path.length === 0) {
    return { ...node, ratio: snapRatio(newRatio) }
  }
  const [head, ...rest] = path
  const newChildren: [SplitNode, SplitNode] = [...node.children]
  newChildren[head] = updateRatio(node.children[head], rest, newRatio)
  return { ...node, children: newChildren }
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/lib/split-tree.ts
git commit -m "feat(grid): add split tree utility functions"
```

---

### Task 3: Config Persistence

**Files:**
- Modify: `src/main/config-service.ts`
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add gridLayout to ConfigService.load()**

In `src/main/config-service.ts`, inside the `load()` method's config parsing block (after `containerSessions` around line 68), add:

```typescript
gridLayout: parsed.gridLayout ?? null,
```

Also add `gridLayout: null` to the `DEFAULT_CONFIG` object (after `containerSessions: {}`).

- [ ] **Step 2: Add gridLayout to ConfigService.update()**

In `src/main/config-service.ts`, inside the `update()` method (after the `containerSessions` line around line 138), add:

```typescript
if (partial.gridLayout !== undefined) this.config.gridLayout = partial.gridLayout
```

- [ ] **Step 3: Add gridLayout state to session-store.ts**

In `src/renderer/stores/session-store.ts`:

Add to the `SessionStore` interface:

```typescript
gridLayout: SplitNode | null
setGridLayout: (layout: SplitNode | null) => void
persistGridLayout: () => Promise<void>
resetGridLayout: () => void
```

Add to the store initial state:

```typescript
gridLayout: null,
```

Add the actions:

```typescript
setGridLayout: (layout) => set({ gridLayout: layout }),

persistGridLayout: async () => {
  const { gridLayout } = get()
  await window.cccAPI.config.update({ gridLayout: gridLayout ?? undefined })
},

resetGridLayout: () => {
  set({ gridLayout: null })
  void window.cccAPI.config.update({ gridLayout: null })
},
```

Add to `loadConfig` (inside the `set()` call, after `enableContainers`):

```typescript
gridLayout: config.gridLayout ?? null,
```

Add the import at the top of session-store.ts:

```typescript
import type { ..., SplitNode } from '../../shared/types'
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/config-service.ts src/renderer/stores/session-store.ts
git commit -m "feat(grid): add gridLayout config persistence and store state"
```

---

### Task 4: DragHandle Component

**Files:**
- Create: `src/renderer/components/DragHandle.tsx`
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Create DragHandle.tsx**

```typescript
import { useCallback, useRef } from 'react'
import type { SplitDirection } from '../../shared/types'

interface DragHandleProps {
  direction: SplitDirection
  containerRef: React.RefObject<HTMLDivElement | null>
  onRatioChange: (ratio: number) => void
  onDragEnd: () => void
}

export default function DragHandle({
  direction,
  containerRef,
  onRatioChange,
  onDragEnd
}: DragHandleProps): React.JSX.Element {
  const dragging = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true

      const container = containerRef.current
      if (!container) return

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'

      // Disable pointer events on all terminals during drag
      const terminals = document.querySelectorAll<HTMLElement>('.xterm-container')
      terminals.forEach((el) => { el.style.pointerEvents = 'none' })

      const handleMouseMove = (ev: MouseEvent): void => {
        if (!dragging.current || !container) return
        const rect = container.getBoundingClientRect()
        let ratio: number
        if (direction === 'horizontal') {
          ratio = (ev.clientX - rect.left) / rect.width
        } else {
          ratio = (ev.clientY - rect.top) / rect.height
        }
        onRatioChange(ratio)
      }

      const handleMouseUp = (): void => {
        dragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        terminals.forEach((el) => { el.style.pointerEvents = '' })
        onDragEnd()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [direction, containerRef, onRatioChange, onDragEnd]
  )

  return (
    <div
      className={`split-drag-handle ${direction === 'horizontal' ? 'split-drag-handle-h' : 'split-drag-handle-v'}`}
      onMouseDown={handleMouseDown}
    />
  )
}
```

- [ ] **Step 2: Add drag handle CSS to index.css**

Add after the `.sidebar-drag-handle:hover` block (around line 77):

```css
/* Split pane drag handles */
.split-drag-handle {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.split-drag-handle-h {
  width: 4px;
  cursor: col-resize;
}

.split-drag-handle-v {
  height: 4px;
  cursor: row-resize;
}

.split-drag-handle::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

.split-drag-handle-h::before {
  left: -3px;
  right: -3px;
}

.split-drag-handle-v::before {
  top: -3px;
  bottom: -3px;
}

.split-drag-handle:hover {
  background-color: var(--accent);
  opacity: 0.7;
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/DragHandle.tsx src/renderer/styles/index.css
git commit -m "feat(grid): add DragHandle component with snap behavior"
```

---

### Task 5: SplitPane Component

**Files:**
- Create: `src/renderer/components/SplitPane.tsx`

- [ ] **Step 1: Create SplitPane.tsx**

```typescript
import { useCallback, useRef } from 'react'
import { Box } from 'lucide-react'
import type { Session, SplitNode } from '../../shared/types'
import { useSessionStore } from '../stores/session-store'
import { snapRatio } from '../lib/split-tree'
import TerminalPanel from './TerminalPanel'
import DragHandle from './DragHandle'

interface SplitPaneProps {
  node: SplitNode
  sessions: Session[]
  path: number[]
  onRatioChange: (path: number[], ratio: number) => void
  onDragEnd: () => void
  onActivate: (id: string) => void
  onDoubleClick: (id: string) => void
  activeSessionId: string | null
}

export default function SplitPane({
  node,
  sessions,
  path,
  onRatioChange,
  onDragEnd,
  onActivate,
  onDoubleClick,
  activeSessionId
}: SplitPaneProps): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleRatioChange = useCallback(
    (ratio: number) => {
      onRatioChange(path, snapRatio(ratio))
    },
    [path, onRatioChange]
  )

  if (node.type === 'leaf') {
    const session = sessions.find((s) => s.id === node.sessionId)
    if (!session) return null

    return (
      <div
        className="grid-card"
        onClick={() => onActivate(session.id)}
        onDoubleClick={() => onDoubleClick(session.id)}
      >
        <div
          className="h-6 flex items-center px-2 flex-shrink-0"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <span
            className={`w-[6px] h-[6px] rounded-full flex-shrink-0 mr-1.5 ${session.type === 'claude' && (session.status === 'working' || session.status === 'waiting') ? 'status-pulse' : ''}`}
            style={{
              backgroundColor: session.type === 'claude'
                ? session.status === 'idle' ? 'var(--success)'
                : session.status === 'working' ? 'var(--accent)'
                : session.status === 'waiting' ? 'var(--error)'
                : 'var(--text-muted)'
                : 'var(--text-muted)'
            }}
          />
          <span
            className="text-[10px] font-medium truncate flex-1"
            style={{
              color: session.id === activeSessionId ? session.color : 'var(--text-secondary)'
            }}
          >
            {session.name}
          </span>
          {session.isContainer && (
            <Box size={10} className="ml-1 flex-shrink-0" style={{ color: 'var(--container)' }} />
          )}
          {session.type === 'claude' && (
            <span
              className="text-[8px] font-semibold uppercase tracking-wide ml-2 flex-shrink-0"
              style={{
                color: session.status === 'idle' ? 'var(--success)'
                  : session.status === 'working' ? 'var(--accent)'
                  : session.status === 'waiting' ? 'var(--error)'
                  : 'var(--text-muted)'
              }}
            >
              {session.status === 'idle' ? 'idle' : session.status === 'working' ? 'working' : session.status === 'waiting' ? 'input' : session.status}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 min-w-0 flex">
          <TerminalPanel session={session} />
        </div>
      </div>
    )
  }

  // Split node
  const flexDirection = node.direction === 'horizontal' ? 'row' : 'column'

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full min-w-0 min-h-0"
      style={{ flexDirection }}
    >
      <div style={{ flex: node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <SplitPane
          node={node.children[0]}
          sessions={sessions}
          path={[...path, 0]}
          onRatioChange={onRatioChange}
          onDragEnd={onDragEnd}
          onActivate={onActivate}
          onDoubleClick={onDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
      <DragHandle
        direction={node.direction}
        containerRef={containerRef}
        onRatioChange={handleRatioChange}
        onDragEnd={onDragEnd}
      />
      <div style={{ flex: 1 - node.ratio, minWidth: 0, minHeight: 0, display: 'flex' }}>
        <SplitPane
          node={node.children[1]}
          sessions={sessions}
          path={[...path, 1]}
          onRatioChange={onRatioChange}
          onDragEnd={onDragEnd}
          onActivate={onActivate}
          onDoubleClick={onDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SplitPane.tsx
git commit -m "feat(grid): add recursive SplitPane component"
```

---

### Task 6: Rewrite GridView

**Files:**
- Modify: `src/renderer/components/GridView.tsx`

- [ ] **Step 1: Rewrite GridView.tsx**

Replace the entire contents of `src/renderer/components/GridView.tsx` with:

```typescript
import { useCallback, useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import { buildAutoGrid, updateRatio, collectSessionIds, removeSession, addSession } from '../lib/split-tree'
import SplitPane from './SplitPane'

export default function GridView(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const gridLayout = useSessionStore((s) => s.gridLayout)
  const setGridLayout = useSessionStore((s) => s.setGridLayout)
  const persistGridLayout = useSessionStore((s) => s.persistGridLayout)
  const resetGridLayout = useSessionStore((s) => s.resetGridLayout)

  const visibleSessions = sessions.filter((s) => !s.isExcluded)
  const visibleIds = new Set(visibleSessions.map((s) => s.id))
  const prevVisibleIdsRef = useRef<Set<string>>(visibleIds)

  // Sync layout with session changes
  useEffect(() => {
    const prevIds = prevVisibleIdsRef.current
    prevVisibleIdsRef.current = visibleIds

    if (visibleSessions.length === 0) {
      if (gridLayout !== null) setGridLayout(null)
      return
    }

    // No layout yet — build auto grid
    if (gridLayout === null) {
      setGridLayout(buildAutoGrid(visibleSessions.map((s) => s.id)))
      return
    }

    const treeIds = new Set(collectSessionIds(gridLayout))

    // Find added and removed sessions
    const added = visibleSessions.filter((s) => !treeIds.has(s.id))
    const removedIds = [...treeIds].filter((id) => !visibleIds.has(id))

    if (added.length === 0 && removedIds.length === 0) return

    let newLayout = gridLayout
    // Remove sessions that are no longer visible
    for (const id of removedIds) {
      const result = removeSession(newLayout, id)
      if (result === null) {
        setGridLayout(null)
        return
      }
      newLayout = result
    }
    // Add new sessions
    for (const s of added) {
      newLayout = addSession(newLayout, s.id)
    }
    setGridLayout(newLayout)
  }, [visibleSessions.length, ...visibleSessions.map((s) => s.id)])

  const handleRatioChange = useCallback(
    (path: number[], ratio: number) => {
      if (!gridLayout || gridLayout.type !== 'split') return
      const newLayout = updateRatio(gridLayout, path, ratio)
      setGridLayout(newLayout)
    },
    [gridLayout, setGridLayout]
  )

  const handleDragEnd = useCallback(() => {
    void persistGridLayout()
  }, [persistGridLayout])

  const handleDoubleClick = useCallback(
    (id: string) => {
      setActiveSession(id)
      setViewMode('single')
    },
    [setActiveSession, setViewMode]
  )

  if (!gridLayout || visibleSessions.length === 0) {
    return <div className="flex-1" style={{ backgroundColor: 'var(--bg-primary)' }} />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div
        className="h-7 flex items-center justify-end px-2 flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--bg-raised)' }}
      >
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          onClick={resetGridLayout}
          title="Reset layout"
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>
      {/* Split tree */}
      <div className="flex-1 min-h-0 flex">
        <SplitPane
          node={gridLayout}
          sessions={visibleSessions}
          path={[]}
          onRatioChange={handleRatioChange}
          onDragEnd={handleDragEnd}
          onActivate={setActiveSession}
          onDoubleClick={handleDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/GridView.tsx
git commit -m "feat(grid): rewrite GridView to use recursive split tree"
```

---

### Task 7: CSS Cleanup

**Files:**
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Remove obsolete drag-over and dragging styles**

In `src/renderer/styles/index.css`, remove these two blocks (lines 133–140):

```css
.grid-card.drag-over {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.grid-card.dragging {
  opacity: 0.5;
}
```

Also remove the `.grid-view` display: grid style (lines 111–117) and replace with:

```css
.grid-view {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: var(--bg-primary);
}
```

Note: The `.grid-view` class is no longer used by GridView (it uses flex layout now), but keeping it as flex avoids breaking anything that might still reference it. If nothing references it after the rewrite, it can be removed entirely.

- [ ] **Step 2: Run typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles/index.css
git commit -m "feat(grid): update CSS for split layout, remove drag-reorder styles"
```

---

### Task 8: Integration — Session Lifecycle Wiring

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Wire gridLayout into session removal**

In `session-store.ts`, update the `removeSession` action to also remove the session from the grid layout. After the existing `set()` call in `removeSession` (around line 155), add cleanup:

```typescript
removeSession: async (id) => {
  await window.cccAPI.session.kill(id)
  set((state) => {
    const sessions = state.sessions.filter((s) => s.id !== id)
    // Clean up grid layout
    let gridLayout = state.gridLayout
    if (gridLayout) {
      const { removeSession: removeFromTree } = await import('../lib/split-tree')
      // Note: can't use dynamic import in sync set(). Handle below.
    }
    return {
      sessions,
      activeSessionId:
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId
    }
  })
},
```

Actually, since `set()` is synchronous and we already import split-tree functions at the top of the file, the cleaner approach is to add the import at the top and update inline:

Add import at top of `session-store.ts`:

```typescript
import { removeSession as removeFromTree } from '../lib/split-tree'
```

Then update the `removeSession` action:

```typescript
removeSession: async (id) => {
  await window.cccAPI.session.kill(id)
  set((state) => {
    const sessions = state.sessions.filter((s) => s.id !== id)
    const gridLayout = state.gridLayout ? removeFromTree(state.gridLayout, id) : null
    return {
      sessions,
      gridLayout,
      activeSessionId:
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId
    }
  })
  void get().persistGridLayout()
},
```

- [ ] **Step 2: Wire gridLayout into toggleExcluded**

Update `toggleExcluded` in the store to also update the grid layout when excluding/including. After the existing `set()` in `toggleExcluded`, the GridView's `useEffect` already handles syncing the layout when visible sessions change, so no additional work is needed here. The `useEffect` dependency on `visibleSessions` in GridView handles this.

Verify this by reading the GridView code — the `useEffect` watches session count and IDs and reconciles the tree automatically.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "feat(grid): wire session removal into split tree cleanup"
```

---

### Task 9: Manual Verification

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify equal grid**

Create 2, 3, and 4 sessions. Confirm they appear in the expected auto-grid layouts:
- 2 sessions: side by side 50/50
- 3 sessions: left + right stacked
- 4 sessions: 2×2 grid

- [ ] **Step 3: Verify drag resize**

Drag the divider between sessions. Confirm:
- Cursor changes to col-resize or row-resize
- Handle highlights on hover
- Ratio snaps to 25/33/50/66/75% positions
- Terminals refit after drag (no blank space, correct cols/rows)

- [ ] **Step 4: Verify session lifecycle**

- Create a new session while in grid view → appears by splitting largest pane
- Kill a session → sibling takes its space
- Exclude a session → removed from grid, sibling expands
- Include it back → reappears in grid

- [ ] **Step 5: Verify persistence**

- Resize some panes, then close and reopen the app
- Confirm layout is restored from config

- [ ] **Step 6: Verify reset**

- Click the Reset button in grid toolbar
- Confirm all panes return to equal sizes

- [ ] **Step 7: Verify double-click**

- Double-click a grid card → switches to single view for that session

- [ ] **Step 8: Commit any fixes**

If any issues found, fix and commit with descriptive message.
