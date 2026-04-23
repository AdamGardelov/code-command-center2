import { Circle, CircleDot } from 'lucide-react'
import type { PullRequest } from '../../shared/types'

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function CiBadge({ status }: { status: PullRequest['checksStatus'] }): React.JSX.Element | null {
  if (status === 'none') return null
  const palette = {
    passing: { color: 'var(--s-done)', symbol: '✓' },
    failing: { color: 'var(--s-error)', symbol: '×' },
    pending: { color: 'var(--s-waiting)', symbol: '•' }
  } as const
  const { color, symbol } = palette[status]
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 600,
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`
      }}
    >
      {symbol} CI
    </span>
  )
}

function ReviewBadge({ pr }: { pr: PullRequest }): React.JSX.Element | null {
  if (pr.reviewers.length === 0) return null
  const approvedCount = pr.reviewers.filter(r => r.state === 'approved').length
  const changesCount = pr.reviewers.filter(r => r.state === 'changes_requested').length

  if (pr.reviewDecision === 'approved') {
    return (
      <span
        className="inline-flex items-center"
        style={{
          gap: 3,
          padding: '1px 5px',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--s-done)',
          backgroundColor: 'color-mix(in srgb, var(--s-done) 14%, transparent)'
        }}
      >
        ✓ {approvedCount}
      </span>
    )
  }
  if (pr.reviewDecision === 'changes_requested') {
    return (
      <span
        className="inline-flex items-center"
        style={{
          gap: 3,
          padding: '1px 5px',
          borderRadius: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 600,
          color: 'var(--s-error)',
          backgroundColor: 'color-mix(in srgb, var(--s-error) 14%, transparent)'
        }}
      >
        × {changesCount}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 600,
        color: 'var(--s-waiting)',
        backgroundColor: 'color-mix(in srgb, var(--s-waiting) 14%, transparent)'
      }}
    >
      {pr.reviewers.length} review
    </span>
  )
}

export default function PrRow({
  pr,
  onContextMenu
}: {
  pr: PullRequest
  onContextMenu: (e: React.MouseEvent, pr: PullRequest) => void
}): React.JSX.Element {
  const repoShort = pr.repo.split('/').pop() ?? pr.repo

  return (
    <button
      onClick={() => window.cccAPI.shell.openExternal(pr.url)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, pr)
      }}
      className="w-full transition-colors duration-100"
      style={{
        display: 'grid',
        gridTemplateColumns: '16px 1fr auto',
        gap: 8,
        alignItems: 'flex-start',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 6,
        backgroundColor: 'transparent',
        cursor: 'pointer',
        textAlign: 'left'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--line-soft)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {/* Icon */}
      <span style={{ marginTop: 2, color: pr.isDraft ? 'var(--ink-3)' : 'var(--s-done)' }}>
        {pr.isDraft ? <Circle size={12} /> : <CircleDot size={12} />}
      </span>

      {/* Main */}
      <span className="min-w-0 flex flex-col" style={{ gap: 3 }}>
        <span
          className="truncate"
          style={{
            fontSize: 12,
            color: pr.isDraft ? 'var(--ink-2)' : 'var(--ink-0)',
            fontWeight: 500,
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {pr.title}
        </span>
        <span
          className="flex flex-wrap items-center"
          style={{
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: 'var(--ink-3)'
          }}
        >
          <span>#{pr.number}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{repoShort}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span style={{ color: 'var(--s-done)' }}>+{pr.additions}</span>
          <span style={{ color: 'var(--s-error)' }}>−{pr.deletions}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{timeAgoShort(pr.updatedAt)}</span>
          {pr.unresolvedThreads > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span style={{ color: 'var(--s-waiting)' }}>⚠ {pr.unresolvedThreads}</span>
            </>
          )}
        </span>
      </span>

      {/* Right: badges */}
      <span className="flex flex-col items-end" style={{ gap: 4 }}>
        <CiBadge status={pr.checksStatus} />
        <ReviewBadge pr={pr} />
      </span>
    </button>
  )
}
