import { useState } from 'react'
import { Plus, LayoutGrid, Monitor, PanelLeftClose, Settings, SquareTerminal, ChevronDown, ChevronRight, Search, Server } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SessionCard from './SessionCard'
import type { Session } from '../../shared/types'

function GeminiIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 28C14 21.77 9.94 16.66 4.42 15.08C2.91 14.64 1.36 14.38 0 14.25V13.75C1.36 13.62 2.91 13.36 4.42 12.92C9.94 11.34 14 6.23 14 0C14 6.23 18.06 11.34 23.58 12.92C25.09 13.36 26.64 13.62 28 13.75V14.25C26.64 14.38 25.09 14.64 23.58 15.08C18.06 16.66 14 21.77 14 28Z" fill="#4285F4" />
    </svg>
  )
}

function ClaudeIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill="#D97757" />
    </svg>
  )
}

interface CategoryProps {
  icon: React.ReactNode
  label: string
  count: number
  sessions: Session[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  defaultOpen?: boolean
}

function Category({ icon, label, count, sessions, activeSessionId, onSelect, defaultOpen = true }: CategoryProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]"
      >
        {open
          ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        }
        {icon}
        <span className="text-[11px] font-semibold flex-1 text-left" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {count}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1 mt-0.5 ml-1">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => onSelect(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface MachineGroupProps {
  name: string
  online: boolean
  isLocal?: boolean
  sessions: Session[]
  activeSessionId: string | null
  onSelect: (id: string) => void
}

function MachineGroup({ name, online, isLocal, sessions, activeSessionId, onSelect }: MachineGroupProps): React.JSX.Element {
  const [open, setOpen] = useState(true)

  const claudeSessions = sessions.filter((s) => s.type === 'claude')
  const geminiSessions = sessions.filter((s) => s.type === 'gemini')
  const shellSessions = sessions.filter((s) => s.type === 'shell')

  return (
    <div className="mb-1" style={{ opacity: online ? 1 : 0.4 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)]"
      >
        {open
          ? <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          : <ChevronRight size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        }
        <Server size={10} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wide flex-1 text-left" style={{ color: 'var(--text-secondary)' }}>
          {name}
        </span>
        {!isLocal && (
          <span
            className="text-[8px] px-1 py-px rounded font-medium"
            style={{
              color: online ? 'var(--success)' : 'var(--text-muted)',
              backgroundColor: online ? 'var(--success)' + '20' : 'var(--bg-raised)'
            }}
          >
            {online ? 'online' : 'offline'}
          </span>
        )}
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {sessions.length}
        </span>
      </button>
      {open && (
        <div className="ml-1">
          {claudeSessions.length > 0 && (
            <Category
              icon={<ClaudeIcon size={12} />}
              label="Claude Code"
              count={claudeSessions.length}
              sessions={claudeSessions}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {geminiSessions.length > 0 && (
            <Category
              icon={<GeminiIcon size={12} />}
              label="Gemini"
              count={geminiSessions.length}
              sessions={geminiSessions}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {shellSessions.length > 0 && (
            <Category
              icon={<SquareTerminal size={11} style={{ color: 'var(--text-secondary)' }} />}
              label="Shell"
              count={shellSessions.length}
              sessions={shellSessions}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default function SessionSidebar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const hostStatuses = useSessionStore((s) => s.hostStatuses)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = searchQuery
    ? sessions.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions

  const hasRemoteHosts = remoteHosts.length > 0

  const claudeSessions = filtered.filter((s) => s.type === 'claude')
  const geminiSessions = filtered.filter((s) => s.type === 'gemini')
  const shellSessions = filtered.filter((s) => s.type === 'shell')
  const runningCount = sessions.filter((s) => s.status === 'working' || s.status === 'idle' || s.status === 'waiting').length

  const localSessions = filtered.filter((s) => !s.remoteHost)

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)'
      }}
    >
      {/* Header */}
      <div className="px-2 pt-2 pb-1 flex items-center gap-1 flex-shrink-0">
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
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="New Session (Ctrl+N)"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={toggleSettings}
          className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
          style={{ color: 'var(--text-muted)' }}
          title="Settings"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pb-1.5 flex-shrink-0">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          <Search size={11} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="flex-1 bg-transparent border-none outline-none text-[11px]"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-1.5 py-0.5 min-h-0">
        {hasRemoteHosts ? (
          <>
            <MachineGroup
              name="Local"
              online={true}
              isLocal
              sessions={localSessions}
              activeSessionId={activeSessionId}
              onSelect={setActiveSession}
            />
            {remoteHosts
              .filter((rh) => hostStatuses[rh.name] !== false)
              .map((rh) => {
                const hostSessions = filtered.filter((s) => s.remoteHost === rh.name)
                return (
                  <MachineGroup
                    key={rh.name}
                    name={rh.name}
                    online={hostStatuses[rh.name] ?? false}
                    sessions={hostSessions}
                    activeSessionId={activeSessionId}
                    onSelect={setActiveSession}
                  />
                )
              })}
          </>
        ) : (
          <>
            {claudeSessions.length > 0 && (
              <Category
                icon={<ClaudeIcon size={12} />}
                label="Claude Code"
                count={claudeSessions.length}
                sessions={claudeSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}

            {geminiSessions.length > 0 && (
              <Category
                icon={<GeminiIcon size={12} />}
                label="Gemini"
                count={geminiSessions.length}
                sessions={geminiSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}

            {shellSessions.length > 0 && (
              <Category
                icon={<SquareTerminal size={11} style={{ color: 'var(--text-secondary)' }} />}
                label="Shell"
                count={shellSessions.length}
                sessions={shellSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}
          </>
        )}

        {sessions.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              No sessions
            </p>
          </div>
        )}

        {searchQuery && filtered.length === 0 && sessions.length > 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              No matches
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-2 py-1.5 border-t flex items-center gap-1 flex-shrink-0"
        style={{ borderColor: 'var(--bg-raised)' }}
      >
        <div className="flex gap-0.5 flex-1">
          <button
            onClick={() => setViewMode('single')}
            className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors duration-100"
            style={{
              backgroundColor: viewMode === 'single' ? 'var(--bg-raised)' : 'transparent',
              color: viewMode === 'single' ? 'var(--text-primary)' : 'var(--text-muted)'
            }}
          >
            <Monitor size={10} />
            Single
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className="flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors duration-100"
            style={{
              backgroundColor: viewMode === 'grid' ? 'var(--accent-muted)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            <LayoutGrid size={10} />
            Grid
          </button>
        </div>
        <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
          {runningCount}/{sessions.length}
        </span>
      </div>
    </div>
  )
}
