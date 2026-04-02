import { useSessionStore } from '../../stores/session-store'

export default function AdvancedSettings(): React.JSX.Element {
  const ideCommand = useSessionStore(s => s.ideCommand)
  const setIdeCommand = useSessionStore(s => s.setIdeCommand)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)

  return (
    <div className="space-y-6">
      {/* IDE Command */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>IDE Command</h3>
        <input
          className="w-full px-3 py-2 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          placeholder="code"
          value={ideCommand}
          onChange={(e) => setIdeCommand(e.target.value)}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Command to open working directory in your editor (e.g. code, cursor, rider)
        </p>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="rounded accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Show notifications when sessions finish or need input
          </span>
        </label>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          OS notifications when app is unfocused, in-app toasts when focused
        </p>
      </div>
    </div>
  )
}
