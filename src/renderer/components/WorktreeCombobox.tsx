import { useState, useRef, useEffect } from 'react'
import { GitBranch, ChevronDown, X, Search, Trash2 } from 'lucide-react'
import type { Worktree } from '../../shared/types'

interface WorktreeComboboxProps {
  worktrees: Worktree[]
  loading: boolean
  selected: string | null
  onSelect: (path: string) => void
  onClear: () => void
  onDelete: (path: string) => void
}

export default function WorktreeCombobox({
  worktrees,
  loading,
  selected,
  onSelect,
  onClear,
  onDelete
}: WorktreeComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [focusIndex, setFocusIndex] = useState(0)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedWorktree = worktrees.find((wt) => wt.path === selected)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFilter('')
        setConfirmingDelete(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const filtered = worktrees.filter((wt) =>
    wt.branch.toLowerCase().includes(filter.toLowerCase())
  )

  // Reset focus index when filter changes
  useEffect(() => {
    setFocusIndex(0)
  }, [filter])

  if (loading) {
    return (
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        Loading worktrees...
      </p>
    )
  }

  if (worktrees.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
        No worktrees found for this repo
      </p>
    )
  }

  // Collapsed state — selected
  if (!open && selectedWorktree) {
    return (
      <div
        ref={containerRef}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors duration-100"
        style={{
          backgroundColor: 'var(--accent-muted)',
          borderColor: 'var(--accent)'
        }}
        onClick={() => setOpen(true)}
        role="combobox"
        aria-expanded={false}
      >
        <GitBranch size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="font-medium truncate" style={{ color: 'var(--accent)' }}>
          {selectedWorktree.branch}
        </span>
        <button
          type="button"
          className="ml-auto p-0.5 rounded transition-colors hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          aria-label="Clear selection"
        >
          <X size={10} />
        </button>
      </div>
    )
  }

  // Collapsed state — nothing selected
  if (!open) {
    return (
      <div
        ref={containerRef}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors duration-100 hover:border-[var(--accent)]"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--bg-raised)'
        }}
        onClick={() => setOpen(true)}
        role="combobox"
        aria-expanded={false}
      >
        <GitBranch size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-muted)' }}>Select worktree...</span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
      </div>
    )
  }

  // --- Expanded state rendered in Task 2 ---
  // Placeholder for now:
  return <div ref={containerRef}>expanded placeholder</div>
}
