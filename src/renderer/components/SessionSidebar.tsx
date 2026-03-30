import { Plus, LayoutGrid, Monitor, PanelLeftClose } from 'lucide-react'
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

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)'
      }}
    >
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Collapse sidebar (Ctrl+B)"
        >
          <PanelLeftClose size={13} />
        </button>
        <span
          className="text-[10px] uppercase tracking-[1.5px] font-medium flex-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Sessions
        </span>
        <button
          onClick={toggleModal}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="New Session (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isActive={s.id === activeSessionId}
            onClick={() => setActiveSession(s.id)}
          />
        ))}
      </div>

      <div
        className="px-3 py-2.5 border-t flex gap-1"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <button
          onClick={() => setViewMode('single')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors duration-100"
          style={{
            backgroundColor: viewMode === 'single' ? 'var(--bg-raised)' : 'transparent',
            color: viewMode === 'single' ? 'var(--text-primary)' : 'var(--text-muted)'
          }}
        >
          <Monitor size={12} />
          Single
        </button>
        <button
          onClick={() => setViewMode('grid')}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors duration-100"
          style={{
            backgroundColor: viewMode === 'grid' ? 'var(--accent-muted)' : 'transparent',
            color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)'
          }}
        >
          <LayoutGrid size={12} />
          Grid
        </button>
      </div>
    </div>
  )
}
