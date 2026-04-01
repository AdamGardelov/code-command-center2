import { useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'

export default function AppearanceSettings(): React.JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)
  const [zoomFactor, setZoomFactor] = useState(1.0)

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setZoomFactor(config.zoomFactor ?? 1.0)
    })
  }, [])

  const resetSidebarWidth = (): void => {
    setSidebarWidth(260)
    void persistSidebarWidth()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Theme toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Currently {theme}
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      {/* Zoom Factor */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Zoom</div>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
            {Math.round((zoomFactor ?? 1.0) * 100)}%
          </div>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={zoomFactor ?? 1.0}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            setZoomFactor(val)
            window.cccAPI.window.setZoomFactor(val)
            void window.cccAPI.config.update({ zoomFactor: val })
          }}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          <span>50%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Sidebar width reset */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Sidebar Width</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Reset to default (260px)
          </div>
        </div>
        <button
          onClick={resetSidebarWidth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>
    </div>
  )
}
