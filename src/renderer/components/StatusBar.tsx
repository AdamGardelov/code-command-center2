import { useSessionStore } from '../stores/session-store'

export default function StatusBar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const viewMode = useSessionStore((s) => s.viewMode)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const gridLabel = (): string => {
    if (viewMode === 'single') return 'Single'
    const count = sessions.length
    if (count <= 2) return `Grid 1×${count}`
    if (count <= 4) return `Grid 2×${Math.ceil(count / 2)}`
    return `Grid ${Math.ceil(count / 3)}×3`
  }

  return (
    <div
      className="h-7 flex items-center justify-between px-4 text-[10px] border-t select-none"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        color: 'var(--text-muted)'
      }}
    >
      <span>
        <span style={{ color: 'var(--accent)' }}>{sessions.length}</span> sessions
      </span>
      <span>
        {activeSession && (
          <>
            Active: <span style={{ color: 'var(--accent)' }}>{activeSession.name}</span>
          </>
        )}
      </span>
      <span>{gridLabel()}</span>
    </div>
  )
}
