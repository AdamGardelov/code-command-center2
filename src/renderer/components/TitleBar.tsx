import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function TitleBar(): React.JSX.Element {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div
      className="h-9 flex items-center justify-between px-4 border-b select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        WebkitAppRegion: 'drag'
      } as React.CSSProperties}
    >
      {/* Left: app name */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: 'var(--accent)' }}
          />
          <span
            className="text-[11px] font-bold tracking-wider uppercase"
            style={{ color: 'var(--text-primary)', letterSpacing: '0.08em' }}
          >
            CCC
          </span>
        </div>
        {activeSession && (
          <>
            <span style={{ color: 'var(--bg-raised)' }} className="text-[10px]">/</span>
            <span
              className="text-[11px] font-medium"
              style={{ color: activeSession.color ?? 'var(--text-secondary)' }}
            >
              {activeSession.name}
            </span>
            {activeSession.status === 'working' && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider status-pulse"
                style={{
                  backgroundColor: 'var(--accent-muted)',
                  color: 'var(--accent)'
                }}
              >
                working
              </span>
            )}
            {activeSession.status === 'waiting' && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider status-pulse"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--error)'
                }}
              >
                needs input
              </span>
            )}
          </>
        )}
      </div>

      {/* Right: controls */}
      <div
        className="flex items-center gap-0.5"
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
