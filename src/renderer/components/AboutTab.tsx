import { useState } from 'react'
import { RefreshCw, Copy, Check } from 'lucide-react'
import { useUpdaterStore } from '../stores/updater-store'

export function AboutTab(): React.JSX.Element {
  const state = useUpdaterStore((s) => s.state)
  const check = useUpdaterStore((s) => s.check)
  const install = useUpdaterStore((s) => s.install)
  const [isChecking, setIsChecking] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [manualCommand, setManualCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCheck(): Promise<void> {
    setIsChecking(true)
    try {
      await check()
    } finally {
      setIsChecking(false)
    }
  }

  async function handleInstall(): Promise<void> {
    setIsInstalling(true)
    try {
      const result = await install()
      if (result.manual && result.command) {
        setManualCommand(result.command)
      }
    } finally {
      setIsInstalling(false)
    }
  }

  function handleCopy(): void {
    if (!manualCommand) return
    window.cccAPI.clipboard.writeText(manualCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lastChecked = state.lastCheckedAt
    ? new Date(state.lastCheckedAt).toLocaleString()
    : 'never'

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div>
        <div className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Current version</div>
        <div style={{ color: 'var(--text-primary)' }}>v{state.currentVersion || '…'}</div>
      </div>

      <div>
        <div className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Last checked</div>
        <div style={{ color: 'var(--text-primary)' }}>{lastChecked}</div>
      </div>

      <div>
        <div className="mb-0.5" style={{ color: 'var(--text-muted)' }}>Status</div>
        <div style={{ color: 'var(--text-primary)' }}>
          {state.status === 'checking' && 'Checking for updates…'}
          {state.status === 'up-to-date' && "You're on the latest version"}
          {state.status === 'update-available' &&
            `Update available: v${state.latestVersion}`}
          {state.status === 'error' && `Error: ${state.errorMessage ?? 'unknown'}`}
          {state.status === 'idle' && 'Idle'}
        </div>
      </div>

      {state.status === 'update-available' && state.releaseNotes && (
        <div>
          <div className="mb-1" style={{ color: 'var(--text-muted)' }}>Release notes</div>
          <pre
            className="text-xs whitespace-pre-wrap p-2 rounded max-h-48 overflow-auto"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
          >
            {state.releaseNotes}
          </pre>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={isChecking || state.status === 'checking'}
          className="flex items-center gap-2 px-3 py-1.5 rounded transition-colors duration-100 disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
        >
          <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
          Check for updates
        </button>

        {state.status === 'update-available' && !manualCommand && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={isInstalling}
            className="px-3 py-1.5 rounded transition-colors duration-100 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent, #fff)' }}
          >
            {isInstalling ? 'Installing…' : 'Update now'}
          </button>
        )}
      </div>

      {manualCommand && (
        <div>
          <div className="mb-1" style={{ color: 'var(--text-muted)' }}>
            Run this command in a terminal to update:
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 p-2 rounded overflow-x-auto"
              style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              {manualCommand}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded transition-colors duration-100"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              title="Copy command"
            >
              {copied ? (
                <Check className="w-3 h-3" style={{ color: 'var(--accent)' }} />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
