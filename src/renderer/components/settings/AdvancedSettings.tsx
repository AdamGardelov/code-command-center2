import { useState, useEffect } from 'react'
import { useSessionStore } from '../../stores/session-store'
import type { ClaudeConfigRoute } from '../../../shared/types'

export default function AdvancedSettings(): React.JSX.Element {
  const dangerouslySkipPermissions = useSessionStore(s => s.dangerouslySkipPermissions)
  const setDangerouslySkipPermissions = useSessionStore(s => s.setDangerouslySkipPermissions)
  const ideCommand = useSessionStore(s => s.ideCommand)
  const setIdeCommand = useSessionStore(s => s.setIdeCommand)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)

  const [editRouteIdx, setEditRouteIdx] = useState<number | null>(null)
  const [editRouteForm, setEditRouteForm] = useState({ pathPrefix: '', configDir: '' })
  const [addRouteMode, setAddRouteMode] = useState(false)
  const [claudeConfigRoutes, setClaudeConfigRoutes] = useState<ClaudeConfigRoute[]>([])
  const [defaultClaudeConfigDir, setDefaultClaudeConfigDir] = useState('')

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setClaudeConfigRoutes(config.claudeConfigRoutes ?? [])
      setDefaultClaudeConfigDir(config.defaultClaudeConfigDir ?? '')
    })
  }, [])

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

      {/* Skip Permissions */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Skip Permissions</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dangerouslySkipPermissions}
            onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
            className="rounded accent-[var(--accent)]"
          />
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Pass --dangerously-skip-permissions to new Claude sessions
          </span>
        </label>
        <p className="text-[10px] mt-1" style={{ color: 'var(--warning, #f59e0b)' }}>
          Warning: This allows Claude to execute commands without confirmation
        </p>
      </div>

      {/* Claude Config Routing */}
      <div>
        <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Claude Config Routing</h3>
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          Route sessions to different Claude configurations based on working directory
        </p>

        {/* Default config dir */}
        <div className="mb-3">
          <label className="text-[10px] mb-1 block" style={{ color: 'var(--text-secondary)' }}>Default Config Dir</label>
          <input
            className="w-full px-3 py-2 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            placeholder="~/.claude (leave empty for default)"
            value={defaultClaudeConfigDir}
            onChange={(e) => {
              const val = e.target.value
              setDefaultClaudeConfigDir(val)
              window.cccAPI.config.update({ defaultClaudeConfigDir: val || undefined })
            }}
          />
        </div>

        {/* Route list */}
        {claudeConfigRoutes.map((route, i) => (
          editRouteIdx === i ? (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Path prefix (~/Dev/Project)"
                value={editRouteForm.pathPrefix}
                onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
              />
              <input
                className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                placeholder="Config dir (~/.claude-project)"
                value={editRouteForm.configDir}
                onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
              />
              <button
                className="px-2.5 py-1 rounded text-[11px] font-medium"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                onClick={() => {
                  const updated = [...claudeConfigRoutes]
                  updated[i] = editRouteForm
                  setClaudeConfigRoutes(updated)
                  window.cccAPI.config.update({ claudeConfigRoutes: updated })
                  setEditRouteIdx(null)
                }}
              >Save</button>
              <button
                className="px-2 py-1 rounded text-[11px]"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => setEditRouteIdx(null)}
              >Cancel</button>
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded" style={{ backgroundColor: 'var(--bg-primary)' }}>
              <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{route.pathPrefix}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>→</span>
              <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{route.configDir}</span>
              <button
                className="text-[10px] px-2 py-1 rounded hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => { setEditRouteIdx(i); setEditRouteForm(route) }}
              >Edit</button>
              <button
                className="text-[10px] px-2 py-1 rounded hover:bg-[var(--bg-raised)]"
                style={{ color: 'var(--error)' }}
                onClick={() => {
                  const updated = claudeConfigRoutes.filter((_, j) => j !== i)
                  setClaudeConfigRoutes(updated)
                  window.cccAPI.config.update({ claudeConfigRoutes: updated })
                }}
              >Delete</button>
            </div>
          )
        ))}

        {addRouteMode ? (
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              placeholder="Path prefix (~/Dev/Project)"
              value={editRouteForm.pathPrefix}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
            />
            <input
              className="flex-1 px-2 py-1 rounded text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
              placeholder="Config dir (~/.claude-project)"
              value={editRouteForm.configDir}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
            />
            <button
              className="px-2.5 py-1 rounded text-[11px] font-medium"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
              onClick={() => {
                if (editRouteForm.pathPrefix && editRouteForm.configDir) {
                  const updated = [...claudeConfigRoutes, editRouteForm]
                  setClaudeConfigRoutes(updated)
                  window.cccAPI.config.update({ claudeConfigRoutes: updated })
                  setAddRouteMode(false)
                  setEditRouteForm({ pathPrefix: '', configDir: '' })
                }
              }}
            >Add</button>
            <button
              className="px-2 py-1 rounded text-[11px]"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => { setAddRouteMode(false); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
            >Cancel</button>
          </div>
        ) : (
          <button
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
            onClick={() => { setAddRouteMode(true); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
          >
            + Add route
          </button>
        )}
      </div>
    </div>
  )
}
