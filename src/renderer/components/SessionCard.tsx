import { useState, useRef, useEffect } from 'react'
import { GitBranch, Trash2, Folder, Zap, Bot, Box, Grid2x2X, Server } from 'lucide-react'
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
  idle: 'var(--s-idle)',
  working: 'var(--s-working)',
  waiting: 'var(--s-waiting)',
  stopped: 'var(--ink-3)',
  error: 'var(--s-error)'
}

const pulseStatuses = new Set(['working', 'waiting'])

const showStatus = (session: Session): boolean => session.type !== 'shell'

type FlagTone = 'auto' | 'skip' | 'container' | 'host'

interface SessionFlag {
  tone: FlagTone
  label: string
  title: string
  icon?: React.ReactNode
}

function collectFlags(session: Session): SessionFlag[] {
  const flags: SessionFlag[] = []
  if (session.enableAutoMode) {
    flags.push({ tone: 'auto', label: 'auto', title: 'Auto mode enabled', icon: <Bot size={8} /> })
  }
  if (session.skipPermissions) {
    flags.push({ tone: 'skip', label: 'skip', title: 'Skip permissions enabled', icon: <Zap size={8} /> })
  }
  if (session.isContainer) {
    flags.push({
      tone: 'container',
      label: session.containerName ?? 'box',
      title: `Container: ${session.containerName ?? ''}`,
      icon: <Box size={8} />
    })
  }
  if (session.remoteHost) {
    flags.push({
      tone: 'host',
      label: session.remoteHost,
      title: `Remote host: ${session.remoteHost}`,
      icon: <Server size={8} />
    })
  }
  return flags
}

const flagPalette: Record<FlagTone, { bg: string; fg: string; dot: string }> = {
  auto: {
    bg: 'color-mix(in srgb, var(--amber) 18%, transparent)',
    fg: 'var(--amber)',
    dot: 'var(--amber)'
  },
  skip: {
    bg: 'color-mix(in srgb, var(--s-error) 18%, transparent)',
    fg: 'var(--s-error)',
    dot: 'var(--s-error)'
  },
  container: {
    bg: 'color-mix(in srgb, var(--container) 18%, transparent)',
    fg: 'var(--container)',
    dot: 'var(--container)'
  },
  host: {
    bg: 'var(--bg-2)',
    fg: 'var(--ink-2)',
    dot: 'var(--ink-2)'
  }
}

function FlagDot({ flag }: { flag: SessionFlag }): React.JSX.Element {
  const { dot } = flagPalette[flag.tone]
  const glow = flag.tone === 'auto' ? `0 0 4px color-mix(in srgb, ${dot} 60%, transparent)` : undefined
  return (
    <span
      aria-hidden
      title={flag.title}
      style={{
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: dot,
        boxShadow: glow,
        flexShrink: 0
      }}
    />
  )
}

function FlagPill({ flag }: { flag: SessionFlag }): React.JSX.Element {
  const { bg, fg } = flagPalette[flag.tone]
  return (
    <span
      title={flag.title}
      className="inline-flex items-center flex-shrink-0"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 8.5,
        padding: '1px 4px',
        borderRadius: 3,
        backgroundColor: bg,
        color: fg,
        lineHeight: 1.3,
        gap: 3
      }}
    >
      {flag.icon}
      {flag.label}
    </span>
  )
}

export default function SessionCard({ session, isActive, onClick }: SessionCardProps): React.JSX.Element {
  const removeSession = useSessionStore((s) => s.removeSession)
  const renamingSessionId = useSessionStore((s) => s.renamingSessionId)
  const setRenamingSessionId = useSessionStore((s) => s.setRenamingSessionId)
  const setDisplayName = useSessionStore((s) => s.setDisplayName)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (renamingSessionId === session.id && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingSessionId, session.id])

  const dotColor = statusColors[session.status] ?? 'var(--ink-3)'
  const pulses = pulseStatuses.has(session.status)
  const excludedDashed = session.isExcluded && !session.isArchived
  const flags = collectFlags(session)

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`scard group relative w-full text-left transition-colors duration-100${isActive ? ' active' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '12px 1fr auto',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderRadius: 6,
          backgroundColor: isActive ? 'var(--amber-wash)' : 'transparent',
          opacity: session.isArchived ? 0.5 : 1,
          cursor: 'pointer',
          border: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--line-soft)'
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {/* Left accent rail (active only) */}
        {isActive && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 6,
              bottom: 6,
              width: 2,
              borderRadius: '0 2px 2px 0',
              backgroundColor: 'var(--amber)'
            }}
          />
        )}

        {/* Column 1: Status dot */}
        <span
          aria-hidden
          className={pulses ? 'status-pulse' : ''}
          style={
            excludedDashed
              ? {
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  justifySelf: 'center',
                  backgroundImage: `repeating-linear-gradient(45deg, ${dotColor} 0 2px, transparent 2px 4px)`
                }
              : {
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  justifySelf: 'center',
                  backgroundColor: showStatus(session) ? dotColor : 'var(--ink-4)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.2)'
                }
          }
        />

        {/* Column 2: Name + meta */}
        <span className="flex flex-col min-w-0" style={{ gap: 1 }}>
          {/* Row 1 — name + tiny flag dots */}
          <span className="flex items-center min-w-0" style={{ gap: 6 }}>
            {renamingSessionId === session.id ? (
              <input
                ref={renameInputRef}
                type="text"
                defaultValue={session.displayName || session.name}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  else if (e.key === 'Escape') setRenamingSessionId(null)
                }}
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim()
                  if (value !== '' && value !== session.name) {
                    void setDisplayName(session.id, value)
                  } else if (value === '' || value === session.name) {
                    void setDisplayName(session.id, '')
                  }
                  setRenamingSessionId(null)
                }}
                onClick={(e) => e.stopPropagation()}
                className="truncate flex-1 bg-transparent border-b outline-none"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--ink-0)',
                  borderColor: 'var(--amber)'
                }}
              />
            ) : (
              <span
                className="scard__name truncate"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: isActive ? 'var(--amber-hi)' : 'var(--ink-0)',
                  flex: '1 1 auto',
                  minWidth: 0
                }}
              >
                {session.displayName || session.name}
              </span>
            )}

            {flags.length > 0 && (
              <span className="scard__flags inline-flex items-center flex-shrink-0" style={{ gap: 3 }} aria-hidden>
                {flags.map((f) => (
                  <FlagDot key={f.tone + f.label} flag={f} />
                ))}
              </span>
            )}
            {session.isExcluded && !session.isArchived && (
              <span title="Excluded from grid" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                <Grid2x2X size={10} />
              </span>
            )}
          </span>

          {/* Row 2 — branch/dir + (on hover/active) labeled pills */}
          {(() => {
            const hasBranch = !!session.gitBranch
            const hasDir = !!session.workingDirectory && session.workingDirectory !== '~'
            const hasFlags = flags.length > 0
            if (!hasBranch && !hasDir && !hasFlags) return null
            return (
              <span
                className="flex items-center min-w-0"
                style={{
                  gap: 5,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  color: 'var(--ink-3)'
                }}
              >
                {hasBranch ? (
                  <>
                    <GitBranch size={9} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                    <span className="truncate" style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {session.gitBranch}
                    </span>
                  </>
                ) : hasDir ? (
                  <>
                    <Folder size={9} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                    <span className="truncate" style={{ flex: '1 1 auto', minWidth: 0 }}>
                      {shortenPath(session.workingDirectory)}
                    </span>
                  </>
                ) : (
                  <span style={{ flex: '1 1 auto', minWidth: 0 }} />
                )}

                {hasFlags && (
                  <span className="scard__tags inline-flex items-center flex-shrink-0" style={{ gap: 3 }}>
                    {flags.map((f) => (
                      <FlagPill key={f.tone + f.label} flag={f} />
                    ))}
                  </span>
                )}
              </span>
            )
          })()}
        </span>

        {/* Column 3: Elapsed / delete */}
        <span className="flex items-center" style={{ gap: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>
          <span className="group-hover:opacity-0 transition-opacity duration-100">
            {formatRelativeTime(session.lastActiveAt)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void removeSession(session.id)
            }}
            className="absolute rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity duration-100"
            style={{
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: 2,
              color: 'var(--s-error)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            title="Kill session"
          >
            <Trash2 size={12} />
          </button>
        </span>
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
