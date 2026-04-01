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
  return buildAutoGridInner(sessionIds, 0)
}

function buildAutoGridInner(sessionIds: string[], depth: number): SplitNode | null {
  if (sessionIds.length === 0) return null
  if (sessionIds.length === 1) return { type: 'leaf', sessionId: sessionIds[0] }

  const direction: SplitDirection = depth % 2 === 0 ? 'vertical' : 'horizontal'

  if (sessionIds.length === 2) {
    return {
      type: 'split',
      direction,
      ratio: 0.5,
      children: [
        { type: 'leaf', sessionId: sessionIds[0] },
        { type: 'leaf', sessionId: sessionIds[1] }
      ]
    }
  }

  // 3+ sessions: split in half recursively, alternating direction by depth
  const mid = Math.ceil(sessionIds.length / 2)
  const left = sessionIds.slice(0, mid)
  const right = sessionIds.slice(mid)
  return {
    type: 'split',
    direction,
    ratio: 0.5,
    children: [
      buildAutoGridInner(left, depth + 1)!,
      buildAutoGridInner(right, depth + 1)!
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
