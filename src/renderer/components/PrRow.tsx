import type { PullRequest } from '../../shared/types'

function StatusBadge({ pr }: { pr: PullRequest }): React.JSX.Element {
  let label: string
  let bg: string
  let fg: string

  if (pr.isDraft) {
    label = 'Draft'; bg = '#666'; fg = '#ccc'
  } else if (pr.reviewDecision === 'approved') {
    label = 'Approved'; bg = '#4ade80'; fg = '#000'
  } else if (pr.reviewDecision === 'changes_requested') {
    label = 'Changes'; bg = '#f87171'; fg = '#000'
  } else if (pr.reviewers.length === 0) {
    label = 'No Reviewer'; bg = '#f59e0b'; fg = '#000'
  } else {
    label = 'In Review'; bg = '#e9c880'; fg = '#000'
  }

  return (
    <span
      className="flex-shrink-0 px-1.5 py-px rounded text-[8px] font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  )
}

function ChecksIcon({ status }: { status: PullRequest['checksStatus'] }): React.JSX.Element | null {
  if (status === 'none') return null
  const color = status === 'passing' ? '#4ade80' : status === 'failing' ? '#f87171' : '#e9c880'
  const symbol = status === 'passing' ? '✓' : status === 'failing' ? '✗' : '○'
  return <span style={{ color, fontSize: 9 }}>{symbol}</span>
}

function ReviewerList({ reviewers }: { reviewers: PullRequest['reviewers'] }): React.JSX.Element | null {
  if (reviewers.length === 0) return null
  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {reviewers.map((r) => {
        const color = r.state === 'approved' ? '#4ade80' : r.state === 'changes_requested' ? '#f87171' : '#888'
        const symbol = r.state === 'approved' ? '✓' : r.state === 'changes_requested' ? '✗' : '○'
        return (
          <span key={r.login} style={{ color, fontSize: 9 }}>
            {symbol} {r.login}
          </span>
        )
      })}
    </div>
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

  const handleClick = (): void => {
    window.open(pr.url, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, pr)
      }}
      className="w-full text-left p-2 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.01)' }}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[11px] flex-1 leading-tight" style={{ color: pr.isDraft ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {pr.title}
        </span>
        <StatusBadge pr={pr} />
      </div>

      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{repoShort}</span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>#{pr.number}</span>
        <span className="text-[9px]" style={{ color: '#4ade80' }}>+{pr.additions}</span>
        <span className="text-[9px]" style={{ color: '#f87171' }}>-{pr.deletions}</span>
        <ChecksIcon status={pr.checksStatus} />
        {pr.unresolvedThreads > 0 && (
          <span className="text-[9px]" style={{ color: '#f59e0b' }}>⚠ {pr.unresolvedThreads}</span>
        )}
      </div>

      <ReviewerList reviewers={pr.reviewers} />
    </button>
  )
}
