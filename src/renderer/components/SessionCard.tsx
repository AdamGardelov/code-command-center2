import { GitBranch, Trash2, Folder, SquareTerminal } from 'lucide-react'
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

function shortenPath(path: string): string {
  return path.replace(/^~\//, '').replace(/^\/home\/[^/]+\//, '')
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
      className="w-full text-left rounded-lg transition-all duration-100 group relative overflow-hidden"
      style={{
        backgroundColor: isActive ? 'var(--bg-raised)' : 'var(--bg-primary)',
        border: `1px solid ${isActive ? session.color + '40' : 'var(--bg-raised)'}`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--bg-raised)'
      }}
    >
      {/* Color accent strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: isActive ? session.color : session.color + '40' }}
      />

      <div className="flex pl-3 pr-2.5 py-2 gap-2.5">
        {/* Type icon */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center mt-0.5"
          style={{
            backgroundColor: isActive ? session.color + '20' : 'var(--bg-raised)',
            border: `1px solid ${isActive ? session.color + '30' : 'transparent'}`
          }}
        >
          {session.type === 'shell' ? (
            <SquareTerminal size={14} style={{ color: isActive ? session.color : 'var(--text-secondary)' }} />
          ) : (
            <svg width={14} height={14} viewBox="0 0 1200 1200" fill="none">
              <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill={isActive ? session.color : '#D97757'} />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
        {/* Row 1: name + status dot + time */}
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold truncate flex-1"
            style={{ color: isActive ? session.color : 'var(--text-primary)' }}
          >
            {session.name}
          </span>
          <span
            className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${pulseStatuses.has(session.status) ? 'status-pulse' : ''}`}
            style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
          />
          <span
            className="text-[9px] tabular-nums flex-shrink-0 group-hover:opacity-0 transition-opacity duration-100"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatRelativeTime(session.lastActiveAt)}
          </span>
          {/* Delete on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              void removeSession(session.id)
            }}
            className="absolute right-2 top-2 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--error)' }}
            title="Kill session"
          >
            <Trash2 size={11} />
          </button>
        </div>

        {/* Row 2: status + git branch */}
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: statusColors[session.status] ?? 'var(--text-muted)' }}
          >
            {statusLabels[session.status] ?? session.status}
          </span>
          {session.gitBranch && (
            <>
              <span style={{ color: 'var(--text-muted)' }} className="text-[9px]">·</span>
              <GitBranch size={9} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
              <span className="text-[9px] truncate" style={{ color: 'var(--text-secondary)' }}>
                {session.gitBranch}
              </span>
            </>
          )}
        </div>

        {/* Row 3: working directory */}
        {session.workingDirectory && session.workingDirectory !== '~' && (
          <div className="flex items-center gap-1 mt-1">
            <Folder size={9} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
            <span className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
              {shortenPath(session.workingDirectory)}
            </span>
          </div>
        )}
        </div>
      </div>
    </button>
  )
}
