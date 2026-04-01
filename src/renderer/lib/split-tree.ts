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
