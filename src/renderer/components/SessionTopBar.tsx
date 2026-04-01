import { GitBranch, Folder, Box } from 'lucide-react'
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
        className="text-[12px] font-semibold"
        style={{ color: session.color ?? 'var(--text-primary)' }}
      >
        {session.name}
      </span>

      {/* Remote host badge */}
      {session.remoteHost && (
        <span
          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}
        >
          {session.remoteHost}
        </span>
      )}

      {/* Container badge */}
      {session.isContainer && (
        <div className="flex items-center gap-1">
          <Box size={11} style={{ color: 'var(--container)' }} />
          {session.containerName && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{ color: 'var(--container)', backgroundColor: 'color-mix(in srgb, var(--container) 15%, var(--bg-raised))' }}
            >
              {session.containerName}
            </span>
          )}
        </div>
      )}

      {/* Status (AI sessions only) */}
      {session.type !== 'shell' && (
        <div className="flex items-center gap-1.5">
          <span
            className={`w-[6px] h-[6px] rounded-full ${session.status === 'working' || session.status === 'waiting' ? 'status-pulse' : ''}`}
            style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
          />
          <span
            className="text-[10px] font-semibold"
            style={{ color: statusColors[session.status] ?? 'var(--text-muted)' }}
          >
            {statusLabels[session.status] ?? session.status}
          </span>
        </div>
      )}

      {/* Git branch */}
      {session.gitBranch && (
        <div className="flex items-center gap-1">
          <GitBranch size={11} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            {session.gitBranch}
          </span>
        </div>
      )}

      {/* Working directory */}
      {session.workingDirectory && session.workingDirectory !== '~' && (
        <div className="flex items-center gap-1 ml-auto">
          <Folder size={11} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[11px] font-medium truncate max-w-[300px]" style={{ color: 'var(--text-muted)' }}>
            {shortenPath(session.workingDirectory)}
          </span>
        </div>
      )}
    </div>
  )
}
