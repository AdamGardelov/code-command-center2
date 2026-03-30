import type { Session } from '../../shared/types'

interface SessionCardProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const statusColors: Record<Session['status'], string> = {
  running: 'var(--accent)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-100 border-l-2 group hover:bg-[rgba(255,255,255,0.03)]"
      style={{
        backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
        borderLeftColor: isActive ? 'var(--accent)' : 'transparent'
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusColors[session.status] }}
        />
        <span
          className="text-xs font-medium truncate"
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {session.name}
        </span>
      </div>
      <div
        className="text-[10px] mt-0.5 ml-3.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {formatRelativeTime(session.lastActiveAt)}
      </div>
    </button>
  )
}
