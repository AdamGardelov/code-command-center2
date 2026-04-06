import React from 'react'
import { ArrowDownCircle } from 'lucide-react'
import { useUpdaterStore } from '../stores/updater-store'
import { useSessionStore } from '../stores/session-store'

export function UpdateIndicator(): React.JSX.Element | null {
  const status = useUpdaterStore((s) => s.state.status)
  const latestVersion = useUpdaterStore((s) => s.state.latestVersion)

  if (status !== 'update-available' || !latestVersion) {
    return null
  }

  function handleClick(): void {
    useSessionStore.getState().openSettingsOnTab('about')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md transition-colors"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)',
        color: 'var(--success)',
        border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)'
      }}
      title={`Update to v${latestVersion}`}
    >
      <ArrowDownCircle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Update available: v{latestVersion}</span>
    </button>
  )
}
