import { useRef } from 'react'
import type { Session } from '../../shared/types'
import { useTerminal } from '../hooks/useTerminal'

interface TerminalPanelProps {
  session: Session
  showHeader?: boolean
}

const statusColors: Record<string, string> = {
  idle: 'var(--success)',
  working: 'var(--accent)',
  waiting: 'var(--error)',
  stopped: 'var(--text-muted)',
  error: 'var(--error)'
}

export default function TerminalPanel({ session, showHeader = false }: TerminalPanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  useTerminal(containerRef, session.id)

  return (
    <div
      className="flex flex-col h-full rounded-md overflow-hidden"
      style={{ backgroundColor: 'var(--bg-terminal)' }}
    >
      {showHeader && (
        <div
          className="h-7 flex items-center px-3 text-[10px] font-semibold border-b flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--bg-raised)',
            color: 'var(--text-secondary)'
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full mr-2"
            style={{ backgroundColor: statusColors[session.status] ?? 'var(--text-muted)' }}
          />
          {session.name}
          {session.gitBranch && (
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
              {session.gitBranch}
            </span>
          )}
        </div>
      )}
      <div ref={containerRef} className="flex-1 xterm-container" />
    </div>
  )
}
