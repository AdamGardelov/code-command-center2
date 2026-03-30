import { GitBranch, Folder } from 'lucide-react'
import type { Session } from '../../shared/types'

interface SessionTopBarProps {
  session: Session
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

function shortenPath(path: string): string {
  return path.replace(/^~\//, '').replace(/^\/home\/[^/]+\//, '')
}

export default function SessionTopBar({ session }: SessionTopBarProps): React.JSX.Element {
  return (
    <div
      className="h-7 flex items-center gap-3 px-3 border-b flex-shrink-0 select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)'
      }}
    >
      {/* Session name */}
      <span
        className="text-[11px] font-semibold"
        style={{ color: session.color ?? 'var(--text-primary)' }}
      >
        {session.name}
      </span>

      {/* Status (AI sessions only) */}
      {session.type !== 'shell' && (
        <div className="flex items-center gap-1.5">
          <span
            className={`w-[5px] h-[5px] rounded-full ${session.status === 'working' || session.status === 'waiting' ? 'status-pulse' : ''}`}
            style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
          />
          <span
            className="text-[9px] font-medium"
            style={{ color: statusColors[session.status] ?? 'var(--text-muted)' }}
          >
            {statusLabels[session.status] ?? session.status}
          </span>
        </div>
      )}

      {/* Git branch */}
      {session.gitBranch && (
        <div className="flex items-center gap-1">
          <GitBranch size={10} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {session.gitBranch}
          </span>
        </div>
      )}

      {/* Working directory */}
      {session.workingDirectory && session.workingDirectory !== '~' && (
        <div className="flex items-center gap-1 ml-auto">
          <Folder size={10} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[10px] truncate max-w-[300px]" style={{ color: 'var(--text-muted)' }}>
            {shortenPath(session.workingDirectory)}
          </span>
        </div>
      )}
    </div>
  )
}
