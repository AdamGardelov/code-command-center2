import type { Session } from '../../shared/types'

interface TerminalPanelProps {
  session: Session
  showHeader?: boolean
}

const mockOutputs: Record<string, string[]> = {
  running: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '│  ~/projects/...                      │',
    '╰──────────────────────────────────────╯',
    '',
    '  Analyzing codebase structure...',
    '  Found 47 files, 3,200 lines',
    '',
    '  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '> I can see your project structure. What would',
    '  you like to work on?',
    '',
    '  ▌'
  ],
  stopped: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  Session ended.',
    '',
    '  ✓ 3 files modified',
    '  ✓ All tasks completed'
  ],
  error: [
    '╭──────────────────────────────────────╮',
    '│  Claude Code  v1.2.3                 │',
    '╰──────────────────────────────────────╯',
    '',
    '  ✗ Error: Connection lost',
    '  Process exited with code 1'
  ]
}

export default function TerminalPanel({ session, showHeader = false }: TerminalPanelProps): React.JSX.Element {
  const lines = mockOutputs[session.status] ?? mockOutputs.running

  return (
    <div
      className="flex flex-col h-full rounded-md overflow-hidden"
      style={{ backgroundColor: '#0d0d14' }}
    >
      {showHeader && (
        <div
          className="h-7 flex items-center px-3 text-[10px] font-semibold border-b flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--bg-raised)',
            color: 'var(--text-secondary)'
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full mr-2"
            style={{
              backgroundColor:
                session.status === 'running'
                  ? 'var(--accent)'
                  : session.status === 'error'
                    ? 'var(--error)'
                    : 'var(--text-muted)'
            }}
          />
          {session.name}
          <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
            {session.workingDirectory}
          </span>
        </div>
      )}
      <div className="flex-1 p-3 overflow-y-auto" style={{ fontFamily: 'var(--font-mono)' }}>
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-[11px] leading-relaxed whitespace-pre"
            style={{
              color: line.startsWith('>')
                ? 'var(--text-primary)'
                : line.includes('✗') || line.includes('Error')
                  ? 'var(--error)'
                  : line.includes('✓')
                    ? 'var(--success)'
                    : line.includes('━')
                      ? 'var(--accent)'
                      : 'var(--text-muted)'
            }}
          >
            {line || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  )
}
