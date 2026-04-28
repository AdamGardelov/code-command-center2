import { useEffect, useMemo, useRef, useState } from 'react'
import { Cloud, Folder, GitBranch, Plus, X } from 'lucide-react'
import type { BranchMetadata, Session } from '../../shared/types'
import { useSessionStore } from '../stores/session-store'

export type BranchPickerMode =
  | 'existing-worktree'
  | 'existing-local'
  | 'track-remote'
  | 'new-branch'

export interface BranchPickerResult {
  mode: BranchPickerMode
  branch: string
  worktreePath?: string
}

interface BranchPickerProps {
  repoPath: string
  remoteHost?: string
  containerName?: string
  onCancel: () => void
  onConfirm: (result: BranchPickerResult) => void
}

type FilterMode = 'all' | 'worktrees' | 'in-use' | 'stale' | 'remote'

interface MatchResult {
  score: number
  ranges: Array<[number, number]>
}

function fuzzyMatch(needle: string, hay: string): MatchResult | null {
  if (!needle) return { score: 0, ranges: [] }
  const n = needle.toLowerCase()
  const h = hay.toLowerCase()
  const idx = h.indexOf(n)
  if (idx !== -1) return { score: 100 - idx, ranges: [[idx, idx + n.length]] }
  let hi = 0
  let ni = 0
  const ranges: Array<[number, number]> = []
  while (hi < h.length && ni < n.length) {
    if (h[hi] === n[ni]) {
      ranges.push([hi, hi + 1])
      ni++
    }
    hi++
  }
  if (ni < n.length) return null
  const merged: Array<[number, number]> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && last[1] === r[0]) last[1] = r[1]
    else merged.push([r[0], r[1]])
  }
  return { score: 50 - (hay.length - needle.length), ranges: merged }
}

function Highlight({ text, ranges }: { text: string; ranges: Array<[number, number]> }): React.JSX.Element {
  if (ranges.length === 0) return <>{text}</>
  const out: React.ReactNode[] = []
  let i = 0
  ranges.forEach(([s, e], k) => {
    if (i < s) out.push(<span key={`p${k}`}>{text.slice(i, s)}</span>)
    out.push(
      <span key={`m${k}`} style={{ color: 'var(--amber)', fontWeight: 600 }}>
        {text.slice(s, e)}
      </span>
    )
    i = e
  })
  if (i < text.length) out.push(<span key="end">{text.slice(i)}</span>)
  return <>{out}</>
}

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function sessionUsingBranch(sessions: Session[], meta: BranchMetadata): Session | undefined {
  if (meta.worktreePath) {
    const wt = sessions.find((s) => s.workingDirectory === meta.worktreePath)
    if (wt) return wt
  }
  return sessions.find((s) => s.gitBranch === meta.branch)
}

interface ScoredBranch {
  meta: BranchMetadata
  ranges: Array<[number, number]>
  activeSession?: Session
}

interface BranchRowProps {
  item: ScoredBranch
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
  dataIdx: number
}

function BranchRow({ item, selected, onSelect, onDelete, dataIdx }: BranchRowProps): React.JSX.Element {
  const { meta, ranges, activeSession } = item
  const classes = ['bp-row']
  if (selected) classes.push('selected')
  if (meta.stale) classes.push('stale')

  return (
    <div className={classes.join(' ')} onClick={onSelect} data-idx={dataIdx}>
      <div className="bp-row__icon">
        {meta.hasWorktree ? (
          <div
            className={`bp-row__wt${activeSession ? ' active' : ''}`}
            title={activeSession ? `Used by "${activeSession.displayName || activeSession.name}"` : 'Worktree exists'}
          >
            <Folder size={13} />
            {activeSession && <span className="bp-row__wt-dot" />}
          </div>
        ) : meta.remoteOnly ? (
          <div className="bp-row__remote-only" title="Branch on origin — will check out a tracking worktree">
            <Cloud size={13} />
          </div>
        ) : (
          <div className="bp-row__remote" title="Local branch — a worktree will be created">
            <GitBranch size={13} />
          </div>
        )}
      </div>

      <div className="bp-row__main">
        <div className="bp-row__top">
          <span className="bp-row__branch">
            <span className="bp-row__branch-name">
              <Highlight text={meta.branch} ranges={ranges} />
            </span>
            {meta.isMain && <span className="bp-row__badge main">default</span>}
            {meta.dirty && (
              <span className="bp-row__badge dirty" title="Uncommitted changes">
                dirty
              </span>
            )}
            {meta.remoteOnly && <span className="bp-row__badge remote">from origin</span>}
            {activeSession && (
              <span className="bp-row__badge active">
                in use · {activeSession.displayName || activeSession.name}
              </span>
            )}
            {meta.stale && <span className="bp-row__badge stale">stale</span>}
          </span>
        </div>
        <div className="bp-row__bottom">
          {meta.lastCommitSubject && <span className="bp-row__commit">{meta.lastCommitSubject}</span>}
          {meta.lastCommitAuthor && (
            <>
              <span className="bp-row__sep">·</span>
              <span className="bp-row__author">{meta.lastCommitAuthor}</span>
            </>
          )}
          {meta.lastCommitTimestamp > 0 && (
            <>
              <span className="bp-row__sep">·</span>
              <span className="bp-row__time">{timeAgo(meta.lastCommitTimestamp)}</span>
            </>
          )}
        </div>
      </div>

      <div className="bp-row__right">
        {(meta.ahead > 0 || meta.behind > 0) && (
          <span className="bp-row__counts">
            {meta.ahead > 0 && <span className="ahead">↑{meta.ahead}</span>}
            {meta.behind > 0 && <span className="behind">↓{meta.behind}</span>}
          </span>
        )}
        {meta.hasWorktree && !meta.isMain && !activeSession && onDelete && (
          <button
            type="button"
            className="bp-row__delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="Delete worktree"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

interface PreviewProps {
  item: ScoredBranch | null
  query: string
  isNewFocused: boolean
}

function Preview({ item, query, isNewFocused }: PreviewProps): React.JSX.Element {
  if (!item) {
    return (
      <div className="bp-preview__empty">
        {isNewFocused ? (
          <>
            Press <kbd>⏎</kbd> to create branch{' '}
            <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{query}</span> and a fresh
            worktree.
          </>
        ) : (
          <>Select a branch to see its details.</>
        )}
      </div>
    )
  }

  const { meta, activeSession } = item
  return (
    <>
      <div className="bp-preview__head">
        {meta.hasWorktree ? (
          <Folder size={13} style={{ color: 'var(--amber)' }} />
        ) : (
          <GitBranch size={13} style={{ color: 'var(--ink-2)' }} />
        )}
        <span className="bp-preview__title">{meta.branch}</span>
        {meta.hasWorktree ? (
          <span className="bp-preview__tag ok">open existing worktree</span>
        ) : meta.remoteOnly ? (
          <span className="bp-preview__tag remote">check out from origin</span>
        ) : (
          <span className="bp-preview__tag new">will create worktree</span>
        )}
      </div>
      <div className="bp-preview__body">
        {meta.worktreePath && (
          <div className="bp-preview__row">
            <span className="k">Path</span>
            <span className="v mono">{meta.worktreePath}</span>
          </div>
        )}
        {meta.lastCommitSubject && (
          <div className="bp-preview__row">
            <span className="k">Last commit</span>
            <span className="v">{meta.lastCommitSubject}</span>
          </div>
        )}
        {(meta.lastCommitAuthor || meta.lastCommitTimestamp > 0) && (
          <div className="bp-preview__row">
            <span className="k">Author</span>
            <span className="v">
              {meta.lastCommitAuthor}
              {meta.lastCommitAuthor && meta.lastCommitTimestamp > 0 ? ' · ' : ''}
              {meta.lastCommitTimestamp > 0 ? timeAgo(meta.lastCommitTimestamp) : ''}
            </span>
          </div>
        )}
        {meta.remote && (
          <div className="bp-preview__row">
            <span className="k">Remote</span>
            <span className="v mono">{meta.remote}</span>
          </div>
        )}
        {(meta.ahead > 0 || meta.behind > 0) && (
          <div className="bp-preview__row">
            <span className="k">vs upstream</span>
            <span className="v mono">
              {meta.ahead > 0 && <span style={{ color: 'var(--s-done)' }}>↑{meta.ahead} ahead</span>}
              {meta.ahead > 0 && meta.behind > 0 && ' '}
              {meta.behind > 0 && <span style={{ color: 'var(--s-error)' }}>↓{meta.behind} behind</span>}
            </span>
          </div>
        )}
        {meta.dirty && (
          <div className="bp-preview__row">
            <span className="k">Status</span>
            <span className="v" style={{ color: 'var(--s-waiting)' }}>
              ● uncommitted changes
            </span>
          </div>
        )}
        {activeSession && (
          <div className="bp-preview__row">
            <span className="k">In use by</span>
            <span className="v" style={{ color: 'var(--amber)' }}>
              session &ldquo;{activeSession.displayName || activeSession.name}&rdquo;
            </span>
          </div>
        )}
      </div>
    </>
  )
}

export default function BranchPicker({
  repoPath,
  remoteHost,
  containerName,
  onCancel,
  onConfirm
}: BranchPickerProps): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const [branches, setBranches] = useState<BranchMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [focusIdx, setFocusIdx] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [fetchTick, setFetchTick] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    window.cccAPI.git
      .getBranchMetadata(repoPath, remoteHost, containerName)
      .then((data) => {
        if (cancelled) return
        setBranches(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load branches')
        setBranches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repoPath, remoteHost, containerName, refreshTick])

  useEffect(() => {
    let cancelled = false
    setFetching(true)
    setFetchFailed(false)
    window.cccAPI.git
      .fetchRemotes(repoPath, remoteHost, containerName)
      .then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setFetchFailed(true)
          return
        }
        setRefreshTick((n) => n + 1)
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true)
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [repoPath, remoteHost, containerName, fetchTick])

  const handleDelete = (path: string): void => {
    void window.cccAPI.git
      .removeWorktree(path, remoteHost, containerName)
      .then(() => setRefreshTick((n) => n + 1))
  }

  const handleManualRefresh = (): void => {
    setFetchTick((n) => n + 1)
  }

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const counts = useMemo(
    () => ({
      all: branches.length,
      worktrees: branches.filter((b) => b.hasWorktree).length,
      stale: branches.filter((b) => b.stale).length,
      inUse: branches.filter((b) => !!sessionUsingBranch(sessions, b)).length,
      remote: branches.filter((b) => b.remoteOnly).length
    }),
    [branches, sessions]
  )

  const { scored, isNew } = useMemo(() => {
    const base = branches.filter((b) => {
      if (filterMode === 'worktrees') return b.hasWorktree
      if (filterMode === 'stale') return b.stale
      if (filterMode === 'in-use') return !!sessionUsingBranch(sessions, b)
      if (filterMode === 'remote') return b.remoteOnly
      return true
    })

    const withMeta: ScoredBranch[] = []
    if (!query) {
      for (const b of base) {
        withMeta.push({ meta: b, ranges: [], activeSession: sessionUsingBranch(sessions, b) })
      }
    } else {
      const matched: Array<ScoredBranch & { score: number }> = []
      for (const b of base) {
        const m = fuzzyMatch(query, b.branch)
        if (m) {
          matched.push({
            meta: b,
            ranges: m.ranges,
            score: m.score,
            activeSession: sessionUsingBranch(sessions, b)
          })
        }
      }
      matched.sort((a, b) => b.score - a.score)
      for (const row of matched) withMeta.push(row)
    }

    const exact = branches.some((b) => b.branch === query)
    return { scored: withMeta, isNew: query.length > 0 && !exact }
  }, [branches, filterMode, query, sessions])

  useEffect(() => {
    setFocusIdx(0)
  }, [query, filterMode])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focusIdx}"]`)
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [focusIdx])

  const total = scored.length + (isNew ? 1 : 0)
  const hovered = isNew && focusIdx === 0 ? null : scored[isNew ? focusIdx - 1 : focusIdx] ?? null

  const confirmRow = (row: ScoredBranch): void => {
    let mode: BranchPickerMode
    if (row.meta.hasWorktree) mode = 'existing-worktree'
    else if (row.meta.remoteOnly) mode = 'track-remote'
    else mode = 'existing-local'

    onConfirm({
      mode,
      branch: row.meta.branch,
      worktreePath: row.meta.worktreePath
    })
  }

  const confirmFocused = (): void => {
    if (isNew && focusIdx === 0) {
      onConfirm({ mode: 'new-branch', branch: query.trim() })
      return
    }
    const row = scored[isNew ? focusIdx - 1 : focusIdx]
    if (row) confirmRow(row)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, Math.max(total - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      confirmFocused()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Backspace' && query === '' && filterMode !== 'all') {
      e.preventDefault()
      setFilterMode('all')
    }
  }

  const confirmLabel = isNew && focusIdx === 0
    ? 'Create branch & worktree'
    : hovered?.meta.hasWorktree
      ? 'Open worktree'
      : hovered?.meta.remoteOnly
        ? 'Check out from origin'
        : 'Checkout worktree'

  return (
    <div className="branch-picker">
      <div className="bp-header">
        <div className="bp-search">
          <button
            type="button"
            className={`bp-refresh${fetching ? ' spinning' : ''}`}
            onClick={handleManualRefresh}
            title={fetching ? 'Fetching from origin…' : 'Refresh branch list from origin'}
            disabled={fetching}
          >
            <GitBranch size={14} style={{ color: 'var(--amber)' }} />
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type a branch name — existing opens worktree, new creates one"
            spellCheck={false}
          />
          {query && (
            <button type="button" className="bp-clear" onClick={() => setQuery('')} title="Clear">
              <X size={11} />
            </button>
          )}
          {fetchFailed && !fetching && (
            <span className="bp-offline-chip" title="Couldn't reach origin — showing cached state">
              offline — cached
            </span>
          )}
        </div>
        <div className="bp-filters">
          {(
            [
              ['all', 'All branches', counts.all],
              ['worktrees', 'With worktree', counts.worktrees],
              ['in-use', 'In use', counts.inUse],
              ['remote', 'Remote', counts.remote],
              ['stale', 'Stale', counts.stale]
            ] as const
          ).map(([k, label, n]) => (
            <button
              type="button"
              key={k}
              className={`bp-pill${filterMode === k ? ' active' : ''}`}
              onClick={() => setFilterMode(k)}
            >
              {label} <span className="bp-pill__count">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bp-list" ref={listRef}>
        {loading && <div className="bp-empty">Loading branches…</div>}
        {!loading && loadError && <div className="bp-empty">Failed to load branches: {loadError}</div>}

        {!loading && isNew && (
          <div
            className={`bp-row new${focusIdx === 0 ? ' selected' : ''}`}
            onClick={() => onConfirm({ mode: 'new-branch', branch: query.trim() })}
            data-idx={0}
          >
            <div className="bp-row__icon">
              <div className="bp-row__new">
                <Plus size={13} />
              </div>
            </div>
            <div className="bp-row__main">
              <div className="bp-row__top">
                <span className="bp-row__branch">
                  Create <span style={{ color: 'var(--amber)' }}>{query}</span>
                </span>
              </div>
              <div className="bp-row__bottom">
                <span className="bp-row__commit">New branch &amp; fresh worktree</span>
              </div>
            </div>
            <div className="bp-row__right">
              <span className="bp-row__hint">⏎</span>
            </div>
          </div>
        )}

        {!loading && !loadError && scored.length === 0 && !isNew && (
          <div className="bp-empty">No branches match</div>
        )}

        {!loading &&
          scored.map((item, i) => {
            const idx = isNew ? i + 1 : i
            return (
              <BranchRow
                key={item.meta.branch}
                item={item}
                selected={focusIdx === idx}
                onSelect={() => confirmRow(item)}
                onDelete={item.meta.worktreePath ? () => handleDelete(item.meta.worktreePath!) : undefined}
                dataIdx={idx}
              />
            )
          })}
      </div>

      <div className="bp-preview">
        <Preview item={hovered} query={query} isNewFocused={isNew && focusIdx === 0} />
      </div>

      <div className="bp-footer">
        <div className="bp-hints">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>⏎</kbd> select
          </span>
          <span>
            <kbd>esc</kbd> cancel
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="bp-btn bp-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="bp-btn bp-btn-primary"
          disabled={loading || (scored.length === 0 && !isNew)}
          onClick={confirmFocused}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
