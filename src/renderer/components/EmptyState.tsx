import { Terminal, Plus } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function EmptyState(): React.JSX.Element {
  const toggleModal = useSessionStore((s) => s.toggleModal)

  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-center"
      style={{
        gap: 18,
        background:
          'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--amber) 8%, transparent) 0%, transparent 55%), var(--bg-0)'
      }}
    >
      {/* Grid mask */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 0%, transparent 70%)'
        }}
      />

      {/* Badge */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          background: 'linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1) 100%)',
          border: '1px solid var(--line)',
          color: 'var(--ink-1)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)'
        }}
      >
        <Terminal size={32} />
        <span
          className="absolute flex items-center justify-center"
          style={{
            right: -6,
            bottom: -6,
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: 'var(--amber)',
            color: 'var(--bg-0)',
            boxShadow: '0 4px 10px color-mix(in srgb, var(--amber) 35%, transparent)'
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
        </span>
      </div>

      <div className="relative text-center" style={{ maxWidth: 340, zIndex: 1 }}>
        <p
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--ink-0)',
            letterSpacing: '-0.01em',
            margin: 0
          }}
        >
          No sessions running
        </p>
        <p
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            marginTop: 8
          }}
        >
          Spin up a{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>claude</span>,{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>codex</span>, or{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>shell</span> session.
          <br />
          Sessions live inside tmux — they persist across restarts.
        </p>
      </div>

      <button
        onClick={toggleModal}
        className="relative inline-flex items-center transition-colors duration-100"
        style={{
          gap: 8,
          padding: '9px 16px',
          border: 'none',
          borderRadius: 8,
          backgroundColor: 'var(--amber)',
          color: 'var(--bg-0)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          zIndex: 1,
          boxShadow: '0 8px 22px -8px color-mix(in srgb, var(--amber) 60%, transparent)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--amber-hi)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--amber)' }}
      >
        <Plus size={14} strokeWidth={2.5} /> New Session
      </button>

      <div className="relative flex" style={{ gap: 12, zIndex: 1 }}>
        <Shortcut keys={['⌘', 'N']} label="New" />
        <Shortcut keys={['⌘', 'G']} label="Grid" />
        <Shortcut keys={['⌘', ',']} label="Settings" />
      </div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        fontSize: 10,
        color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {keys.map((key) => (
        <kbd key={key} className="kbd-lg">
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}
