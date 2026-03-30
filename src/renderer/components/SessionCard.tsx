import { GitBranch, Trash2 } from 'lucide-react'
import type { Session } from '../../shared/types'
import { useSessionStore } from '../stores/session-store'

interface SessionCardProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const statusColors: Record<string, string> = {
  idle: 'var(--success)',
  working: 'var(--accent)',
  waiting: 'var(--error)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting: 'Needs input',
  stopped: 'Stopped',
  error: 'Error'
}

const pulseStatuses = new Set(['working', 'waiting'])

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  const removeSession = useSessionStore((s) => s.removeSession)

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-2 rounded-md transition-all duration-100 group relative"
      style={{
        backgroundColor: isActive ? 'var(--accent-muted)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent'
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.02)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
      }}
    >
      {/* Row 1: status dot + name + time */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${pulseStatuses.has(session.status) ? 'status-pulse' : ''}`}
          style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
        />
        <span
          className="text-[11px] font-medium truncate flex-1"
          style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}
        >
          {session.name}
        </span>
        <span
          className="text-[9px] tabular-nums flex-shrink-0 opacity-60 group-hover:opacity-0 transition-opacity duration-100"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatRelativeTime(session.lastActiveAt)}
        </span>
        {/* Delete button on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            void removeSession(session.id)
          }}
          className="absolute right-2 top-2 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--error)' }}
          title="Kill session (Ctrl+W)"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Row 2: status label + git branch */}
      <div className="flex items-center gap-1.5 mt-0.5 ml-[11px]">
        <span
          className="text-[9px] font-medium"
          style={{ color: statusColors[session.status] ?? 'var(--text-muted)' }}
        >
          {statusLabels[session.status] ?? session.status}
        </span>
        {session.gitBranch && (
          <>
            <span style={{ color: 'var(--bg-raised)' }} className="text-[9px]">|</span>
            <GitBranch size={9} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
            <span className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
              {session.gitBranch}
            </span>
          </>
        )}
      </div>
    </button>
  )
}
