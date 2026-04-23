import { GitBranch, Folder, Box, Bot, Zap } from 'lucide-react'
import type { Session } from '../../shared/types'

interface SessionTopBarProps {
  session: Session
}

const statusColors: Record<string, string> = {
  idle: 'var(--s-idle)',
  working: 'var(--s-working)',
  waiting: 'var(--s-waiting)',
  stopped: 'var(--ink-3)',
  error: 'var(--s-error)'
}

const statusLabels: Record<string, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting: 'Waiting for input',
  stopped: 'Stopped',
  error: 'Error'
}

function shortenPath(path: string): string {
  return path.replace(/^~\//, '').replace(/^\/home\/[^/]+\//, '')
}

function Chip({
  color,
  borderColor,
  children
}: {
  color?: string
  borderColor?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center"
      style={{
        padding: '2px 7px',
        gap: 4,
        borderRadius: 10,
        border: `1px solid ${borderColor ?? 'var(--line)'}`,
        backgroundColor: 'var(--bg-0)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: color ?? 'var(--ink-2)',
        lineHeight: 1.4
      }}
    >
      {children}
    </span>
  )
}

export default function SessionTopBar({ session }: SessionTopBarProps): React.JSX.Element {
  const isAi = session.type !== 'shell'
  const statusColor = statusColors[session.status] ?? 'var(--ink-3)'
  const statusLabel = statusLabels[session.status] ?? session.status

  return (
    <div
      className="flex items-center flex-shrink-0 select-none"
      style={{
        minHeight: 40,
        padding: '8px 14px',
        gap: 10,
        borderBottom: '1px solid var(--line)',
        backgroundColor: 'var(--bg-1)'
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--ink-0)'
        }}
      >
        {session.displayName || session.name}
      </span>

      {session.enableAutoMode && (
        <Chip
          color="var(--amber)"
          borderColor="color-mix(in srgb, var(--amber) 40%, var(--line))"
        >
          <Bot size={10} /> auto-mode
        </Chip>
      )}

      {session.skipPermissions && (
        <Chip
          color="var(--s-error)"
          borderColor="color-mix(in srgb, var(--s-error) 40%, var(--line))"
        >
          <Zap size={10} /> skip-perms
        </Chip>
      )}

      {isAi && (
        <Chip
          color={statusColor}
          borderColor={`color-mix(in srgb, ${statusColor} 40%, var(--line))`}
        >
          <span
            aria-hidden
            className={session.status === 'working' || session.status === 'waiting' ? 'status-pulse' : ''}
            style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor, display: 'inline-block' }}
          />
          {statusLabel}
        </Chip>
      )}

      {session.remoteHost && (
        <Chip>
          {session.remoteHost}
        </Chip>
      )}

      {session.isContainer && (
        <Chip color="var(--container)" borderColor="color-mix(in srgb, var(--container) 40%, var(--line))">
          <Box size={10} /> {session.containerName ?? 'container'}
        </Chip>
      )}

      {session.gitBranch && (
        <span
          className="inline-flex items-center"
          style={{
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-2)'
          }}
        >
          <GitBranch size={11} style={{ color: 'var(--ink-3)' }} />
          <span>{session.gitBranch}</span>
        </span>
      )}

      <div className="flex-1" />

      {session.workingDirectory && session.workingDirectory !== '~' && (
        <span
          className="inline-flex items-center"
          style={{
            gap: 4,
            padding: '4px 8px',
            borderRadius: 5,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-2)'
          }}
          title={session.workingDirectory}
        >
          <Folder size={11} style={{ color: 'var(--ink-3)' }} />
          <span className="truncate" style={{ maxWidth: 300 }}>{shortenPath(session.workingDirectory)}</span>
        </span>
      )}
    </div>
  )
}
