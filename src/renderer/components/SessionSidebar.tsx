import { Plus, LayoutGrid, Monitor, PanelLeftClose, Settings, Bot, Terminal } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SessionCard from './SessionCard'

export default function SessionSidebar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar)

  const claudeSessions = sessions.filter((s) => s.type === 'claude')
  const shellSessions = sessions.filter((s) => s.type === 'shell')
  const runningCount = sessions.filter((s) => s.status === 'working' || s.status === 'idle' || s.status === 'waiting').length

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)'
      }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Collapse sidebar (Ctrl+B)"
        >
          <PanelLeftClose size={13} />
        </button>
        <span className="flex-1" />
        <button
          onClick={toggleModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100 hover:brightness-110"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--bg-primary)'
          }}
          title="New Session (Ctrl+N)"
        >
          <Plus size={12} strokeWidth={2.5} />
          New
        </button>
        <button
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Settings"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {/* Claude sessions */}
        {claudeSessions.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Bot size={11} style={{ color: 'var(--text-muted)' }} />
              <span
                className="text-[9px] uppercase tracking-[1.5px] font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Claude
              </span>
              <span
                className="text-[9px] ml-auto tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {claudeSessions.length}
              </span>
            </div>
            <div className="flex flex-col gap-px">
              {claudeSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onClick={() => setActiveSession(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Shell sessions */}
        {shellSessions.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <Terminal size={11} style={{ color: 'var(--text-muted)' }} />
              <span
                className="text-[9px] uppercase tracking-[1.5px] font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Shell
              </span>
              <span
                className="text-[9px] ml-auto tabular-nums"
                style={{ color: 'var(--text-muted)' }}
              >
                {shellSessions.length}
              </span>
            </div>
            <div className="flex flex-col gap-px">
              {shellSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onClick={() => setActiveSession(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              No sessions
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-2 py-2 border-t flex items-center gap-1"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <div className="flex gap-0.5 flex-1">
          <button
            onClick={() => setViewMode('single')}
            className="flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors duration-100"
            style={{
              backgroundColor: viewMode === 'single' ? 'var(--bg-raised)' : 'transparent',
              color: viewMode === 'single' ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
          >
            <Monitor size={11} />
            Single
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className="flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors duration-100"
            style={{
              backgroundColor: viewMode === 'grid' ? 'var(--accent-muted)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            <LayoutGrid size={11} />
            Grid
          </button>
        </div>
        <span
          className="text-[9px] tabular-nums px-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {runningCount}/{sessions.length}
        </span>
      </div>
    </div>
  )
}
