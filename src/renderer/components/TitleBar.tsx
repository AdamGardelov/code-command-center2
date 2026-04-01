import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import logoSrc from '../assets/logo.png'

export default function TitleBar(): React.JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const platform = useSessionStore((s) => s.platform)
  const isMac = platform === 'darwin'

  return (
    <div
      className="h-8 flex items-center justify-between select-none flex-shrink-0"
      style={{
        backgroundColor: 'var(--bg-primary)',
        WebkitAppRegion: 'drag',
        paddingLeft: isMac ? '78px' : '12px',
        paddingRight: '12px'
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        <img src={logoSrc} alt="CCC" className="w-4 h-4" draggable={false} />
        <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
          CCC
        </span>
      </div>

      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={toggleTheme}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Toggle theme (Ctrl+T)"
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
        {!isMac && (
          <>
            <button
              onClick={() => window.cccAPI.window.minimize()}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => window.cccAPI.window.maximize()}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => window.cccAPI.window.close()}
              className="p-1 rounded transition-colors duration-100 hover:bg-red-500/20 hover:text-red-400"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
