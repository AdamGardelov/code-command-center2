import { useState, useMemo } from 'react'
import { Plus, LayoutGrid, Monitor, SquareTerminal, ChevronRight, Search, Server, GitBranch, Archive } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SessionCard from './SessionCard'
import { UpdateIndicator } from './UpdateIndicator'
import type { Session } from '../../shared/types'

function GeminiIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 28C14 21.77 9.94 16.66 4.42 15.08C2.91 14.64 1.36 14.38 0 14.25V13.75C1.36 13.62 2.91 13.36 4.42 12.92C9.94 11.34 14 6.23 14 0C14 6.23 18.06 11.34 23.58 12.92C25.09 13.36 26.64 13.62 28 13.75V14.25C26.64 14.38 25.09 14.64 23.58 15.08C18.06 16.66 14 21.77 14 28Z" fill="#6ea3f2" />
    </svg>
  )
}

function ClaudeIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 1200 1200" fill="none">
      <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill="#d97757" />
    </svg>
  )
}

function CodexIcon({ size = 12 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" style={{ color: 'var(--p-codex)' }}>
      <path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
    </svg>
  )
}

function CategoryHead({
  open,
  onToggle,
  icon,
  label,
  count,
  tone = 'default'
}: {
  open: boolean
  onToggle: () => void
  icon: React.ReactNode
  label: string
  count: number
  tone?: 'default' | 'machine' | 'muted'
}): React.JSX.Element {
  const color = tone === 'muted' ? 'var(--ink-3)' : 'var(--ink-2)'
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center rounded-md transition-colors duration-100"
      style={{
        padding: '4px 6px',
        gap: 6,
        color,
        fontSize: tone === 'machine' ? 10 : 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--line-soft)' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <ChevronRight
        size={9}
        style={{
          color: 'var(--ink-3)',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 120ms',
          flexShrink: 0
        }}
      />
      <span className="inline-flex items-center" style={{ gap: 5 }}>{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--ink-3)',
          letterSpacing: 0,
          textTransform: 'none'
        }}
      >
        {count}
      </span>
    </button>
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
      <CategoryHead
        open={open}
        onToggle={() => setOpen(!open)}
        icon={icon}
        label={label}
        count={count}
      />
      {open && (
        <div className="flex flex-col gap-1 mt-0.5 ml-2">
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

interface SessionGroupSectionProps {
  name: string
  sessions: Session[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  isAuto?: boolean
}

function SessionGroupSection({ name, sessions, activeSessionId, onSelect, isAuto }: SessionGroupSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-0.5 ml-1">
      <CategoryHead
        open={open}
        onToggle={() => setOpen(!open)}
        icon={<GitBranch size={9} style={{ color: isAuto ? 'var(--ink-3)' : 'var(--amber)' }} />}
        label={name}
        count={sessions.length}
        tone={isAuto ? 'muted' : 'default'}
      />
      {open && (
        <div className="flex flex-col gap-1 mt-0.5 ml-2">
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
  const sessions_ = useSessionStore((s) => s.sessions)
  const sessionGroups = useSessionStore((s) => s.sessionGroups)
  const getGroupedSessions = useSessionStore((s) => s.getGroupedSessions)

  const { groups, ungrouped } = useMemo(() => getGroupedSessions(), [sessions_, sessionGroups])

  const machineSessionIds = new Set(sessions.map(s => s.id))
  const machineGroups = groups
    .map(g => ({
      ...g,
      sessionIds: g.sessionIds.filter(id => machineSessionIds.has(id))
    }))
    .filter(g => g.sessionIds.length > 0)
  const machineUngrouped = ungrouped.filter(id => machineSessionIds.has(id))

  const ungroupedSessions = machineUngrouped
    .map(id => sessions.find(s => s.id === id))
    .filter((s): s is Session => !!s)

  const claudeUngrouped = ungroupedSessions.filter(s => s.type === 'claude')
  const geminiUngrouped = ungroupedSessions.filter(s => s.type === 'gemini')
  const codexUngrouped = ungroupedSessions.filter(s => s.type === 'codex')
  const shellUngrouped = ungroupedSessions.filter(s => s.type === 'shell')

  return (
    <div className="mb-1" style={{ opacity: online ? 1 : 0.4 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center rounded-md transition-colors duration-100"
        style={{
          padding: '4px 6px',
          gap: 6,
          color: 'var(--ink-2)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--line-soft)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <ChevronRight
          size={9}
          style={{
            color: 'var(--ink-3)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 120ms',
            flexShrink: 0
          }}
        />
        <Server size={10} style={{ color: 'var(--ink-3)' }} />
        <span className="flex-1 text-left truncate">{name}</span>
        {!isLocal && (
          <span
            className="rounded"
            style={{
              padding: '1px 5px',
              fontSize: 8.5,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: 0,
              textTransform: 'none',
              color: online ? 'var(--s-done)' : 'var(--ink-3)',
              backgroundColor: online ? 'color-mix(in srgb, var(--s-done) 14%, transparent)' : 'var(--bg-2)'
            }}
          >
            {online ? 'online' : 'offline'}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--ink-3)',
            letterSpacing: 0,
            textTransform: 'none'
          }}
        >
          {sessions.length}
        </span>
      </button>
      {open && (
        <div className="ml-2">
          {machineGroups.map(({ group, sessionIds }) => {
            const groupSessions = sessionIds
              .map(id => sessions.find(s => s.id === id))
              .filter((s): s is Session => !!s)
            return (
              <SessionGroupSection
                key={group.id}
                name={group.name}
                sessions={groupSessions}
                activeSessionId={activeSessionId}
                onSelect={onSelect}
                isAuto={'auto' in group}
              />
            )
          })}
          {claudeUngrouped.length > 0 && (
            <Category
              icon={<ClaudeIcon size={11} />}
              label="Claude"
              count={claudeUngrouped.length}
              sessions={claudeUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {geminiUngrouped.length > 0 && (
            <Category
              icon={<GeminiIcon size={11} />}
              label="Gemini"
              count={geminiUngrouped.length}
              sessions={geminiUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {codexUngrouped.length > 0 && (
            <Category
              icon={<CodexIcon size={11} />}
              label="Codex"
              count={codexUngrouped.length}
              sessions={codexUngrouped}
              activeSessionId={activeSessionId}
              onSelect={onSelect}
            />
          )}
          {shellUngrouped.length > 0 && (
            <Category
              icon={<SquareTerminal size={10} style={{ color: 'var(--amber)' }} />}
              label="Shell"
              count={shellUngrouped.length}
              sessions={shellUngrouped}
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
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const hostStatuses = useSessionStore((s) => s.hostStatuses)
  const [searchQuery, setSearchQuery] = useState('')
  const [archivedOpen, setArchivedOpen] = useState(false)

  const filtered = searchQuery
    ? sessions.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.displayName && s.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions

  const activeSessions = filtered.filter((s) => !s.isArchived)
  const archivedFiltered = filtered.filter((s) => s.isArchived)

  const hasRemoteHosts = remoteHosts.length > 0

  const claudeSessions = activeSessions.filter((s) => s.type === 'claude')
  const geminiSessions = activeSessions.filter((s) => s.type === 'gemini')
  const codexSessions = activeSessions.filter((s) => s.type === 'codex')
  const shellSessions = activeSessions.filter((s) => s.type === 'shell')
  const runningCount = sessions.filter((s) => s.status === 'working' || s.status === 'waiting').length
  const excludedCount = sessions.filter((s) => s.isExcluded && !s.isArchived).length
  const archivedCount = sessions.filter((s) => s.isArchived).length

  const localSessions = activeSessions.filter((s) => !s.remoteHost)

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--bg-1)',
        borderRight: '1px solid var(--line)'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ padding: '8px 10px 4px', gap: 6 }}
      >
        <span
          className="flex-1"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)'
          }}
        >
          Sessions
        </span>
        <button
          onClick={toggleModal}
          className="flex items-center justify-center rounded transition-colors duration-100"
          style={{ width: 20, height: 20, color: 'var(--ink-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-2)'
            e.currentTarget.style.color = 'var(--amber)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--ink-3)'
          }}
          title="New Session (Ctrl+N)"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0" style={{ margin: '4px 8px 6px' }}>
        <div
          className="flex items-center"
          style={{
            padding: '5px 8px',
            gap: 6,
            backgroundColor: 'var(--bg-0)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            transition: 'border-color 120ms'
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--amber-rim)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--line)' }}
        >
          <Search size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions, branches…"
            className="flex-1 bg-transparent border-none outline-none"
            style={{ color: 'var(--ink-0)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
          />
          <span className="kbd" style={{ flexShrink: 0 }}>⌘K</span>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto ccc-scroll min-h-0" style={{ padding: '2px 6px 6px' }}>
        {hasRemoteHosts ? (
          <>
            {localSessions.length > 0 && (
              <MachineGroup
                name="Local"
                online={true}
                isLocal
                sessions={localSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}
            {remoteHosts
              .filter((rh) => hostStatuses[rh.name] !== false)
              .filter((rh) => activeSessions.some((s) => s.remoteHost === rh.name))
              .map((rh) => {
                const hostSessions = activeSessions.filter((s) => s.remoteHost === rh.name)
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
                icon={<ClaudeIcon size={11} />}
                label="Claude"
                count={claudeSessions.length}
                sessions={claudeSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}

            {geminiSessions.length > 0 && (
              <Category
                icon={<GeminiIcon size={11} />}
                label="Gemini"
                count={geminiSessions.length}
                sessions={geminiSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}

            {codexSessions.length > 0 && (
              <Category
                icon={<CodexIcon size={11} />}
                label="Codex"
                count={codexSessions.length}
                sessions={codexSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}

            {shellSessions.length > 0 && (
              <Category
                icon={<SquareTerminal size={10} style={{ color: 'var(--amber)' }} />}
                label="Shell"
                count={shellSessions.length}
                sessions={shellSessions}
                activeSessionId={activeSessionId}
                onSelect={setActiveSession}
              />
            )}
          </>
        )}

        {archivedFiltered.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <CategoryHead
              open={archivedOpen}
              onToggle={() => setArchivedOpen(!archivedOpen)}
              icon={<Archive size={10} style={{ color: 'var(--ink-3)' }} />}
              label="Archived"
              count={archivedFiltered.length}
              tone="muted"
            />
            {archivedOpen && (
              <div className="flex flex-col gap-1 mt-0.5 ml-2">
                {archivedFiltered.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    onClick={() => setActiveSession(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center" style={{ padding: '20px 10px', fontSize: 11, color: 'var(--ink-3)' }}>
            No sessions
          </div>
        )}

        {searchQuery && filtered.length === 0 && sessions.length > 0 && (
          <div
            className="text-center"
            style={{ padding: '20px 10px', fontSize: 11, color: 'var(--ink-3)' }}
          >
            No sessions match &ldquo;<span style={{ color: 'var(--ink-1)' }}>{searchQuery}</span>&rdquo;
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex flex-col flex-shrink-0"
        style={{
          padding: '8px 10px',
          gap: 6,
          borderTop: '1px solid var(--line)'
        }}
      >
        <UpdateIndicator />

        {/* Single / Grid mode toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            padding: 2,
            backgroundColor: 'var(--bg-0)',
            border: '1px solid var(--line)',
            borderRadius: 6
          }}
        >
          <button
            onClick={() => setViewMode('single')}
            className="flex items-center justify-center transition-colors duration-100"
            style={{
              padding: '4px 6px',
              gap: 4,
              backgroundColor: viewMode === 'single' ? 'var(--bg-2)' : 'transparent',
              color: viewMode === 'single' ? 'var(--amber)' : 'var(--ink-3)',
              border: 'none',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { if (viewMode !== 'single') e.currentTarget.style.color = 'var(--ink-1)' }}
            onMouseLeave={(e) => { if (viewMode !== 'single') e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <Monitor size={10} /> Single
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className="flex items-center justify-center transition-colors duration-100"
            style={{
              padding: '4px 6px',
              gap: 4,
              backgroundColor: viewMode === 'grid' ? 'var(--bg-2)' : 'transparent',
              color: viewMode === 'grid' ? 'var(--amber)' : 'var(--ink-3)',
              border: 'none',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => { if (viewMode !== 'grid') e.currentTarget.style.color = 'var(--ink-1)' }}
            onMouseLeave={(e) => { if (viewMode !== 'grid') e.currentTarget.style.color = 'var(--ink-3)' }}
          >
            <LayoutGrid size={10} /> Grid
          </button>
        </div>

        {/* Stats */}
        <div
          className="flex items-center flex-wrap"
          style={{
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-3)'
          }}
        >
          <span className="inline-flex items-center" style={{ gap: 4 }}>
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: runningCount > 0 ? 'var(--s-working)' : 'var(--ink-4)'
              }}
            />
            {runningCount} running
          </span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{sessions.length} total</span>
          {excludedCount > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span>{excludedCount} excluded</span>
            </>
          )}
          {archivedCount > 0 && (
            <>
              <span style={{ color: 'var(--ink-4)' }}>·</span>
              <span>{archivedCount} archived</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
