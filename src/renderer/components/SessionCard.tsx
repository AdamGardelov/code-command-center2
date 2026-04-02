import { useState } from 'react'
import { GitBranch, Trash2, Folder, Zap, Box } from 'lucide-react'
import type { Session } from '../../shared/types'
import { useSessionStore } from '../stores/session-store'
import GroupContextMenu from './GroupContextMenu'

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

const showStatus = (session: Session): boolean => {
  return session.type !== 'shell'
}

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  const removeSession = useSessionStore((s) => s.removeSession)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <>
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY })
      }}
      className="w-full text-left rounded-lg transition-all duration-100 group relative overflow-hidden"
      style={{
        backgroundColor: isActive ? 'var(--bg-raised)' : 'var(--bg-primary)',
        border: `1px solid ${isActive ? session.color + '40' : 'var(--bg-raised)'}`,
        opacity: session.isExcluded ? 0.4 : 1,
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

      <div className="pl-3.5 pr-2.5 py-2">
        {/* Row 1: name + status dot + time */}
        <div className="flex items-center gap-2">
          <span
            className="text-[12px] font-semibold truncate flex-1"
            style={{ color: isActive ? session.color : 'var(--text-primary)' }}
          >
            {session.displayName || session.name}
          </span>
          {session.remoteHost && (
            <span className="text-[8px] px-1 py-px rounded font-medium flex-shrink-0"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-raised)' }}>
              {session.remoteHost}
            </span>
          )}
          {session.isContainer && (
            <>
              <span title={`Container: ${session.containerName}`} style={{ color: 'var(--container)' }}>
                <Box size={12} />
              </span>
              {session.containerName && (
                <span className="text-[8px] px-1 py-px rounded font-medium flex-shrink-0"
                  style={{ color: 'var(--container)', backgroundColor: 'color-mix(in srgb, var(--container) 15%, var(--bg-raised))' }}>
                  {session.containerName}
                </span>
              )}
            </>
          )}
          {session.skipPermissions && (
            <span title="Skip Permissions enabled" style={{ color: 'var(--warning, #f59e0b)' }}>
              <Zap size={12} />
            </span>
          )}
          {showStatus(session) && (
            <span
              className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${pulseStatuses.has(session.status) ? 'status-pulse' : ''}`}
              style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
            />
          )}
          <span
            className="text-[10px] tabular-nums flex-shrink-0 font-medium group-hover:opacity-0 transition-opacity duration-100"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatRelativeTime(session.lastActiveAt)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void removeSession(session.id)
            }}
            className="absolute right-2 top-2 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--error)' }}
            title="Kill session"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {/* Row 2: status + git branch */}
        {(showStatus(session) || session.gitBranch) && (
          <div className="flex items-center gap-1.5 mt-1">
            {showStatus(session) && (
              <span
                className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: statusColors[session.status] ?? 'var(--text-muted)' }}
              >
                {statusLabels[session.status] ?? session.status}
              </span>
            )}
            {showStatus(session) && session.gitBranch && (
              <span style={{ color: 'var(--text-muted)' }} className="text-[10px]">·</span>
            )}
            {session.gitBranch && (
              <>
                <GitBranch size={10} style={{ color: 'var(--text-secondary)' }} className="flex-shrink-0" />
                <span className="text-[10px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                  {session.gitBranch}
                </span>
              </>
            )}
          </div>
        )}

        {/* Row 3: working directory */}
        {session.workingDirectory && session.workingDirectory !== '~' && (
          <div className="flex items-center gap-1 mt-1">
            <Folder size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
            <span className="text-[10px] font-medium truncate" style={{ color: 'var(--text-muted)' }}>
              {shortenPath(session.workingDirectory)}
            </span>
          </div>
        )}
      </div>
    </button>
      {contextMenu && (
        <GroupContextMenu
          sessionId={session.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
