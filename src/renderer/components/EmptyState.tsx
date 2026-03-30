import { Terminal, Plus } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function EmptyState(): React.JSX.Element {
  const toggleModal = useSessionStore((s) => s.toggleModal)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--bg-raised)'
          }}
        >
          <Terminal size={32} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--bg-primary)'
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
        </div>
      </div>

      <div className="text-center max-w-[240px]">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          No sessions running
        </p>
        <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Create a Claude or Shell session to get started. Sessions persist in tmux.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={toggleModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-100 hover:brightness-110"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--bg-primary)'
          }}
        >
          <Plus size={14} strokeWidth={2.5} />
          New Session
        </button>
      </div>

      <div className="flex gap-4 mt-2">
        <Shortcut keys={['Ctrl', 'N']} label="New" />
        <Shortcut keys={['Ctrl', 'G']} label="Grid" />
        <Shortcut keys={['Ctrl', 'B']} label="Sidebar" />
      </div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: 'var(--bg-raised)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
