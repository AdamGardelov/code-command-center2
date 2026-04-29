import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
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
  const search = useTerminal(containerRef, session.id)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (search.visible) inputRef.current?.focus()
  }, [search.visible])

  return (
    <div
      className="flex flex-col flex-1 h-full overflow-hidden terminal-outer"
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
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 xterm-container" />
        {search.visible && (
          <div
            className="absolute flex items-center gap-1 px-2 py-1 rounded shadow-lg"
            style={{
              top: 8,
              right: 16,
              backgroundColor: 'var(--bg-2)',
              border: '1px solid var(--line-soft)',
              zIndex: 10
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search…"
              onChange={(e) => {
                setQuery(e.target.value)
                search.findNext(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('')
                  search.close()
                  return
                }
                if (e.key === 'Enter') {
                  if (e.shiftKey) search.findPrevious(query)
                  else search.findNext(query)
                  e.preventDefault()
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--ink-0)',
                fontSize: 12,
                width: 180
              }}
            />
            <button
              type="button"
              onClick={() => search.findPrevious(query)}
              title="Previous (Shift+Enter)"
              style={{ color: 'var(--ink-2)', padding: 2 }}
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              onClick={() => search.findNext(query)}
              title="Next (Enter)"
              style={{ color: 'var(--ink-2)', padding: 2 }}
            >
              <ChevronDown size={12} />
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                search.close()
              }}
              title="Close (Esc)"
              style={{ color: 'var(--ink-2)', padding: 2 }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
