import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

declare const __APP_VERSION__: string

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
        className="h-5 flex items-center justify-between px-4 text-[10px] font-medium border-t select-none flex-shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          color: 'var(--text-muted)'
        }}
      >
        <span>{runningCount} running · {sessions.length} total</span>
        <div className="flex items-center gap-2">
          <span>v{__APP_VERSION__} · {viewMode === 'grid' ? 'Grid' : 'Single'}</span>
          <button
            onClick={openLogs}
            className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
            title="View logs"
          >
            <FileText size={10} />
          </button>
        </div>
      </div>

      {logOpen && (
        <div
          className="absolute bottom-5 right-0 w-[600px] max-h-[400px] flex flex-col border rounded-t-lg shadow-lg z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--bg-raised)'
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium border-b flex-shrink-0"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-raised)',
              color: 'var(--text-secondary)'
            }}
          >
            <span>Logs — {logPath}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={refreshLogs}
                className="px-1.5 py-0.5 rounded text-[10px] transition-colors hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                Refresh
              </button>
              <button
                onClick={() => setLogOpen(false)}
                className="p-0.5 rounded transition-colors hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <pre
            className="flex-1 overflow-auto p-3 text-[10px] leading-relaxed font-mono whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {logContent || 'No logs yet.'}
          </pre>
        </div>
      )}
    </>
  )
}
