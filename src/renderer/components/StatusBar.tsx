import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

declare const __APP_VERSION__: string

function Dot({ color }: { color: string }): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}
    />
  )
}

export default function StatusBar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const viewMode = useSessionStore((s) => s.viewMode)
  const runningCount = sessions.filter((s) => s.status === 'working' || s.status === 'idle' || s.status === 'waiting').length
  const [logOpen, setLogOpen] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [logPath, setLogPath] = useState('')

  const openLogs = async (): Promise<void> => {
    const [content, path] = await Promise.all([
      window.cccAPI.app.logs(300),
      window.cccAPI.app.logPath()
    ])
    setLogContent(content)
    setLogPath(path)
    setLogOpen(true)
  }

  const refreshLogs = async (): Promise<void> => {
    const content = await window.cccAPI.app.logs(300)
    setLogContent(content)
  }

  return (
    <>
      <div
        className="flex items-center select-none flex-shrink-0"
        style={{
          height: 22,
          padding: '0 10px',
          gap: 14,
          backgroundColor: 'var(--bg-0)',
          borderTop: '1px solid var(--line)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--ink-3)'
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Dot color="var(--s-done)" /> tmux
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Dot color="var(--s-done)" /> local
        </span>
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1.5">
          {runningCount}/{sessions.length} running
        </span>
        <span className="inline-flex items-center gap-1.5">
          view:{' '}
          <span style={{ color: 'var(--amber)' }}>{viewMode === 'grid' ? 'grid' : 'single'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">v{__APP_VERSION__}</span>
        <button
          onClick={openLogs}
          className="flex items-center justify-center rounded transition-colors duration-100"
          style={{ width: 18, height: 18, color: 'var(--ink-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-2)'
            e.currentTarget.style.color = 'var(--ink-1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--ink-3)'
          }}
          title="View logs"
        >
          <FileText size={10} />
        </button>
      </div>

      {logOpen && (
        <div
          className="absolute right-0 z-50 flex flex-col overflow-hidden"
          style={{
            bottom: 22,
            width: 600,
            maxHeight: 400,
            backgroundColor: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            boxShadow: 'var(--shadow-modal)'
          }}
        >
          <div
            className="flex items-center justify-between flex-shrink-0"
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--line)',
              backgroundColor: 'var(--bg-2)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--ink-1)'
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-2)' }}>Logs — {logPath}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={refreshLogs}
                className="rounded transition-colors"
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  color: 'var(--ink-2)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                Refresh
              </button>
              <button
                onClick={() => setLogOpen(false)}
                className="flex items-center justify-center rounded transition-colors"
                style={{ width: 20, height: 20, color: 'var(--ink-3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <pre
            className="flex-1 overflow-auto ccc-scroll whitespace-pre-wrap"
            style={{
              padding: 12,
              fontSize: 10,
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--ink-1)',
              backgroundColor: 'var(--bg-1)'
            }}
          >
            {logContent || 'No logs yet.'}
          </pre>
        </div>
      )}
    </>
  )
}
