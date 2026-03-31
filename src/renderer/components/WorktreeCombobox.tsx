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

function HighlightMatch({ text, query }: { text: string; query: string }): React.JSX.Element {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
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
  const listRef = useRef<HTMLDivElement>(null)

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

  // Scroll focused item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const item = listRef.current.querySelector(`#wt-option-${focusIndex}`)
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIndex, open])

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

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[focusIndex]) {
          onSelect(filtered[focusIndex].path)
          setOpen(false)
          setFilter('')
          setConfirmingDelete(null)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setFilter('')
        setConfirmingDelete(null)
        break
      case 'Backspace':
        if (filter === '' && selected) {
          onClear()
        }
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs border"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--accent)'
        }}
      >
        <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter worktrees..."
          className="flex-1 bg-transparent outline-none text-xs"
          style={{ color: 'var(--text-primary)' }}
          role="combobox"
          aria-expanded={true}
          aria-activedescendant={filtered[focusIndex] ? `wt-option-${focusIndex}` : undefined}
        />
      </div>

      {/* Dropdown list */}
      <div
        ref={listRef}
        className="border border-t-0 rounded-b-lg overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--accent)',
          maxHeight: '200px'
        }}
        role="listbox"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            No worktrees match
          </p>
        ) : (
          filtered.map((wt, i) => {
            const isFocused = i === focusIndex
            const isConfirming = confirmingDelete === wt.path

            if (isConfirming) {
              return (
                <div
                  key={wt.path}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
                >
                  <span style={{ color: 'var(--error)' }}>Delete {wt.branch}?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: 'var(--error)', color: '#fff' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(wt.path)
                        setConfirmingDelete(null)
                      }}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmingDelete(null)
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={wt.path}
                id={`wt-option-${i}`}
                className="group flex items-center px-3 py-2 cursor-pointer transition-colors duration-75"
                style={{
                  backgroundColor: isFocused ? 'var(--accent-muted)' : 'transparent',
                  borderLeft: isFocused ? '2px solid var(--accent)' : '2px solid transparent'
                }}
                onClick={() => {
                  onSelect(wt.path)
                  setOpen(false)
                  setFilter('')
                  setConfirmingDelete(null)
                }}
                onMouseEnter={() => setFocusIndex(i)}
                role="option"
                aria-selected={selected === wt.path}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    <HighlightMatch text={wt.branch} query={filter} />
                  </div>
                  <div
                    className="text-[10px] mt-0.5 truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {wt.path}
                  </div>
                </div>
                <button
                  type="button"
                  className="ml-2 p-1 rounded opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmingDelete(wt.path)
                  }}
                  aria-label={`Delete worktree ${wt.branch}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Keyboard hints */}
      <div className="flex gap-3 mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>↑↓ navigate</span>
        <span>⏎ select</span>
        <span>esc close</span>
      </div>
    </div>
  )
}
