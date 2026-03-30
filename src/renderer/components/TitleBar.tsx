import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

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

export default function TitleBar(): React.JSX.Element {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div
      className="h-9 flex items-center justify-between px-4 border-b select-none flex-shrink-0"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      {/* Left: session info */}
      <div className="flex items-center gap-2 min-w-0">
        {activeSession ? (
          <>
            <span
              className="text-[11px] font-semibold truncate"
              style={{ color: activeSession.color ?? 'var(--text-primary)' }}
            >
              {activeSession.name}
            </span>
            {activeSession.type !== 'shell' && (
              <>
                <span
                  className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColors[activeSession.status] ?? 'var(--text-muted)' }}
                />
                <span
                  className="text-[9px] font-medium uppercase tracking-wide flex-shrink-0"
                  style={{ color: statusColors[activeSession.status] ?? 'var(--text-muted)' }}
                >
                  {statusLabels[activeSession.status] ?? activeSession.status}
                </span>
              </>
            )}
            {activeSession.gitBranch && (
              <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {activeSession.gitBranch}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
            Code Command Center
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div
        className="flex items-center gap-0.5 flex-shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle theme (Ctrl+T)"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
        <div className="w-px h-3 mx-1" style={{ backgroundColor: 'var(--bg-raised)' }} />
        <button
          onClick={() => window.cccAPI.window.minimize()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => window.cccAPI.window.maximize()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.cccAPI.window.close()}
          className="p-1.5 rounded transition-colors duration-100 hover:bg-red-500/20 hover:text-red-400"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
