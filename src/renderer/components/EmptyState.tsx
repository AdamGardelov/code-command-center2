import { Terminal } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function EmptyState(): React.JSX.Element {
  const toggleModal = useSessionStore((s) => s.toggleModal)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <Terminal size={28} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          No sessions yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Create a session to start using Claude Code
        </p>
      </div>
      <button
        onClick={toggleModal}
        className="px-4 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--bg-primary)'
        }}
      >
        Create Session
      </button>
    </div>
  )
}
