import { useSessionStore } from '../stores/session-store'

export default function StatusBar(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const viewMode = useSessionStore((s) => s.viewMode)
  const runningCount = sessions.filter((s) => s.status === 'working' || s.status === 'idle' || s.status === 'waiting').length

  return (
    <div
      className="h-5 flex items-center justify-between px-4 text-[9px] border-t select-none flex-shrink-0"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-raised)',
        color: 'var(--text-muted)'
      }}
    >
      <span>{runningCount} running · {sessions.length} total</span>
      <span>{viewMode === 'grid' ? 'Grid' : 'Single'}</span>
    </div>
  )
}
