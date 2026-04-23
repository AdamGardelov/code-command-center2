import { Minus, Square, X, Sun, Moon } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function TitleBar(): React.JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const platform = useSessionStore((s) => s.platform)
  const isMac = platform === 'darwin'

  return (
    <div
      className="flex items-center select-none flex-shrink-0"
      style={{
        height: 28,
        gap: 10,
        backgroundColor: 'var(--bg-0)',
        borderBottom: '1px solid var(--line)',
        WebkitAppRegion: 'drag',
        paddingLeft: isMac ? '78px' : '10px',
        paddingRight: '4px'
      } as React.CSSProperties}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: 'linear-gradient(135deg, var(--amber) 0%, var(--amber-lo) 100%)',
            color: 'var(--bg-0)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1
          }}
        >
          C
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-2)',
            letterSpacing: '0.02em'
          }}
        >
          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>CCC</span>
          <span style={{ color: 'var(--ink-3)' }}> — Code Command Center</span>
        </div>
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center"
        style={{ gap: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded transition-colors duration-100 hover:bg-[var(--bg-2)]"
          style={{ width: 28, height: 22, color: 'var(--ink-3)' }}
          title="Toggle theme (Ctrl+T)"
        >
          {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
        {!isMac && (
          <>
            <button
              onClick={() => window.cccAPI.window.minimize()}
              className="flex items-center justify-center rounded transition-colors duration-100 hover:bg-[var(--bg-2)]"
              style={{ width: 28, height: 22, color: 'var(--ink-3)' }}
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => window.cccAPI.window.maximize()}
              className="flex items-center justify-center rounded transition-colors duration-100 hover:bg-[var(--bg-2)]"
              style={{ width: 28, height: 22, color: 'var(--ink-3)' }}
            >
              <Square size={10} />
            </button>
            <button
              onClick={() => window.cccAPI.window.close()}
              className="flex items-center justify-center rounded transition-colors duration-100"
              style={{ width: 28, height: 22, color: 'var(--ink-3)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#c04a3c'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = 'var(--ink-3)'
              }}
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
