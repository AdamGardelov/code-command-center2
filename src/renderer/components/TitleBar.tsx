import { Minus, Square, X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function TitleBar(): React.JSX.Element {
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sessions = useSessionStore((s) => s.sessions)
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
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--accent)' }}>
          CCC
        </span>
        {activeSession && (
          <>
            <span style={{ color: 'var(--text-muted)' }} className="text-xs">/</span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {activeSession.name}
            </span>
          </>
        )}
      </div>

      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
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
          <Square size={12} />
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
