import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Pencil, Check, RotateCcw, Server, ChevronDown, ChevronRight } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { FavoriteFolder, AiProvider, RemoteHost, ClaudeConfigRoute } from '../../shared/types'

type Tab = 'providers' | 'favorites' | 'appearance' | 'remotes' | 'worktrees' | 'advanced' | 'features'

export default function SettingsModal(): React.JSX.Element {
  const settingsOpen = useSessionStore((s) => s.settingsOpen)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const favorites = useSessionStore((s) => s.favorites)
  const setFavorites = useSessionStore((s) => s.setFavorites)
  const enabledProviders = useSessionStore((s) => s.enabledProviders)
  const setEnabledProviders = useSessionStore((s) => s.setEnabledProviders)
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)
  const remoteHosts = useSessionStore((s) => s.remoteHosts)
  const setRemoteHosts = useSessionStore((s) => s.setRemoteHosts)
  const worktreeBasePath = useSessionStore((s) => s.worktreeBasePath)
  const worktreeSyncPaths = useSessionStore((s) => s.worktreeSyncPaths)

  const [tab, setTab] = useState<Tab>('providers')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addMode, setAddMode] = useState(false)

  // Advanced tab state
  const [editRouteIdx, setEditRouteIdx] = useState<number | null>(null)
  const [editRouteForm, setEditRouteForm] = useState({ pathPrefix: '', configDir: '' })
  const [addRouteMode, setAddRouteMode] = useState(false)
  const [claudeConfigRoutes, setClaudeConfigRoutes] = useState<ClaudeConfigRoute[]>([])
  const [defaultClaudeConfigDir, setDefaultClaudeConfigDir] = useState('')

  const dangerouslySkipPermissions = useSessionStore(s => s.dangerouslySkipPermissions)
  const setDangerouslySkipPermissions = useSessionStore(s => s.setDangerouslySkipPermissions)
  const ideCommand = useSessionStore(s => s.ideCommand)
  const setIdeCommand = useSessionStore(s => s.setIdeCommand)
  const notificationsEnabled = useSessionStore((s) => s.notificationsEnabled)
  const setNotificationsEnabled = useSessionStore((s) => s.setNotificationsEnabled)

  // Remote hosts state
  const [editRemoteIdx, setEditRemoteIdx] = useState<number | null>(null)
  const [editRemoteForm, setEditRemoteForm] = useState<{ name: string; host: string; shell: string }>({ name: '', host: '', shell: '' })
  const [addRemoteMode, setAddRemoteMode] = useState(false)
  const [expandedRemote, setExpandedRemote] = useState<number | null>(null)
  const [editRemoteFavIdx, setEditRemoteFavIdx] = useState<number | null>(null)
  const [editRemoteFavForm, setEditRemoteFavForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addRemoteFavMode, setAddRemoteFavMode] = useState(false)
  const [zoomFactor, setZoomFactor] = useState(1.0)

  // Features tab state
  const [featuresConfig, setFeaturesConfig] = useState({ pullRequests: false })
  const [prOrg, setPrOrg] = useState('')
  const [prRepos, setPrRepos] = useState('')
  const [prMembers, setPrMembers] = useState('')
  const [prPollInterval, setPrPollInterval] = useState(120)
  const [prShowMyDrafts, setPrShowMyDrafts] = useState(true)
  const [prShowOthersDrafts, setPrShowOthersDrafts] = useState(false)

  useEffect(() => {
    if (settingsOpen) {
      window.cccAPI.config.load().then((config) => {
        setClaudeConfigRoutes(config.claudeConfigRoutes ?? [])
        setDefaultClaudeConfigDir(config.defaultClaudeConfigDir ?? '')
        setZoomFactor(config.zoomFactor ?? 1.0)
        setFeaturesConfig(config.features ?? { pullRequests: false })
        if (config.prConfig) {
          setPrOrg(config.prConfig.githubOrg ?? '')
          setPrRepos(config.prConfig.pinnedRepos?.join(', ') ?? '')
          setPrMembers(config.prConfig.teamMembers?.join(', ') ?? '')
          setPrPollInterval(config.prConfig.pollInterval ?? 120)
          setPrShowMyDrafts(config.prConfig.showMyDrafts !== false)
          setPrShowOthersDrafts(config.prConfig.showOthersDrafts === true)
        }
      })
    }
  }, [settingsOpen])

  const saveRemoteHosts = (updated: RemoteHost[]): void => {
    void setRemoteHosts(updated)
  }

  const saveFeatures = (features: { pullRequests: boolean }): void => {
    setFeaturesConfig(features)
    void window.cccAPI.config.update({ features })
    void useSessionStore.getState().loadConfig()
  }

  const savePrConfig = (): void => {
    void window.cccAPI.config.update({
      prConfig: {
        githubOrg: prOrg,
        pinnedRepos: prRepos.split(',').map(r => r.trim()).filter(Boolean),
        teamMembers: prMembers.split(',').map(m => m.trim()).filter(Boolean),
        pollInterval: prPollInterval,
        showMyDrafts: prShowMyDrafts,
        showOthersDrafts: prShowOthersDrafts,
        notifications: { approved: true, changesRequested: true, newComment: true, newReviewer: true, newPr: true },
        dismissedAttention: [],
      },
    })
  }

  if (!settingsOpen) return <></>

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleSettings()
  }

  const startEdit = (idx: number): void => {
    setEditIdx(idx)
    setEditForm({ ...favorites[idx] })
    setAddMode(false)
  }

  const startAdd = (): void => {
    setAddMode(true)
    setEditIdx(null)
    setEditForm({ name: '', path: '', defaultBranch: 'main' })
  }

  const saveEdit = (): void => {
    if (!editForm.name.trim() || !editForm.path.trim()) return
    const updated = [...favorites]
    if (addMode) {
      updated.push({ ...editForm })
    } else if (editIdx !== null) {
      updated[editIdx] = { ...editForm }
    }
    void setFavorites(updated)
    setEditIdx(null)
    setAddMode(false)
  }

  const cancelEdit = (): void => {
    setEditIdx(null)
    setAddMode(false)
  }

  const removeFavorite = (idx: number): void => {
    const updated = favorites.filter((_, i) => i !== idx)
    void setFavorites(updated)
    if (editIdx === idx) {
      setEditIdx(null)
    }
  }

  const resetSidebarWidth = (): void => {
    setSidebarWidth(260)
    void persistSidebarWidth()
  }

  const inlineForm = (
    <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
      <input
        type="text"
        value={editForm.name}
        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
        placeholder="Name (e.g. api-server)"
        autoFocus
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.path}
        onChange={(e) => setEditForm({ ...editForm, path: e.target.value })}
        placeholder="Path (e.g. ~/projects/api-server)"
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.defaultBranch}
        onChange={(e) => setEditForm({ ...editForm, defaultBranch: e.target.value })}
        placeholder="Default branch (e.g. main)"
        className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <input
        type="text"
        value={editForm.worktreePath ?? ''}
        onChange={(e) => setEditForm({ ...editForm, worktreePath: e.target.value || undefined })}
        placeholder="Worktree path override (optional)"
        className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={cancelEdit}
          className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={saveEdit}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
        >
          <Check size={11} />
          Save
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[560px] max-h-[80vh] flex flex-col rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h2>
          <button
            onClick={toggleSettings}
            className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b" style={{ borderColor: 'var(--bg-raised)' }}>
          {(['providers', 'favorites', 'remotes', 'appearance', 'worktrees', 'advanced', 'features'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-[11px] font-medium transition-colors duration-100 border-b-2"
              style={{
                borderColor: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              {t === 'remotes' ? 'Remote Hosts' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'providers' && (
            <div className="flex flex-col gap-4">
              {/* Claude */}
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: enabledProviders.includes('claude') ? 'var(--bg-raised)' : 'var(--bg-raised)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width={16} height={16} viewBox="0 0 1200 1200" fill="none">
                      <path d="M233.96 800.21L468.64 668.54l3.95-11.44-3.95-6.36h-11.44l-39.22-2.42-134.09-3.62-116.3-4.83L54.93 633.83l-28.35-5.04L0 592.75l2.74-17.48 23.84-16.03 34.15 2.98 75.46 5.15 113.24 7.81 82.15 4.83 121.69 12.65h19.33l2.74-7.81-6.6-4.83-5.16-4.83L346.39 495.79 219.54 411.87l-66.44-48.32-35.92-24.48-18.12-22.95-7.81-50.1 32.62-35.92 43.81 2.98 11.19 2.98 44.38 34.15L318.04 343.57l123.79 91.17 18.12 15.06 7.25-5.15.89-3.62-8.14-13.63-67.46-121.69-71.84-123.79-31.96-51.3-8.46-30.77c-2.98-12.64-5.15-23.27-5.15-36.24L312.32 13.21l20.54-6.6 49.53 6.6 20.86 18.12 30.77 70.39 49.85 110.82 77.32 150.68 22.63 44.7 12.08 41.4 4.51 12.64h7.81v-7.25l6.36-84.89 11.76-104.21 11.44-134.09 3.95-37.77 18.68-45.26 37.13-24.48 29 13.85 23.84 34.15-3.3 22.07-14.17 92.13-27.79 144.32-18.12 96.64h10.55l12.08-12.08 48.89-64.91 82.15-102.68 36.24-40.75 42.28-45.02 27.14-21.42h51.3l37.77 56.13-16.91 57.99-52.83 67-43.81 56.78-62.82 84.56-39.22 67.65 3.62 5.4 9.34-0.89 141.91-30.2 76.67-13.85 91.49-15.7 41.4 19.33 4.51 19.65-16.27 40.19-97.85 24.16-114.77 22.95-170.9 40.43-2.09 1.53 2.42 2.98 76.99 7.25 32.94 1.77 80.62 0 150.12 11.19 39.22 25.93 23.52 31.73-3.95 24.16-60.4 30.77-81.5-19.33-190.23-45.26-65.46-16.27-9.02 0v5.4l54.36 53.15 99.62 89.96 124.75 115.97 6.36 28.67-16.03 22.63-16.91-2.42-109.61-82.47-42.28-37.13-95.76-80.62-5.56 0v8.46l22.07 32.29 116.54 175.17 6.04 53.72-8.46 17.48-30.2 10.55-33.18-6.04-68.21-95.76-70.39-107.84-56.78-96.64-6.93 3.95-33.5 360.89-15.7 18.44-36.24 13.85-30.2-22.95-16.03-37.13 16.03-73.37 19.33-95.87 15.7-76.1 14.17-94.55 8.46-31.41-.56-2.09-6.93.89-71.23 97.85-108.4 146.5-85.77 91.81-20.54 8.14-35.6-18.44 3.3-32.94 19.89-29.32 118.7-150.99 71.6-93.58 46.23-48.17-.32-7.81-2.74 0L205.29 929.4l-56.13 7.25-24.16-22.63 2.98-37.13 11.44-12.08 94.79-65.23Z" fill="#D97757" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Claude Code</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = enabledProviders.includes('claude')
                        ? enabledProviders.filter(p => p !== 'claude')
                        : [...enabledProviders, 'claude'] as AiProvider[]
                      void setEnabledProviders(next)
                    }}
                    className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: enabledProviders.includes('claude') ? 'var(--success)' : 'var(--bg-raised)',
                      color: enabledProviders.includes('claude') ? '#1d1f21' : 'var(--text-muted)'
                    }}
                  >
                    {enabledProviders.includes('claude') ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {enabledProviders.includes('claude') && (
                  <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Requires <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)' }}>claude</code> in PATH
                  </div>
                )}
              </div>

              {/* Gemini */}
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--bg-raised)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width={16} height={16} viewBox="0 0 28 28" fill="none">
                      <path d="M14 28C14 21.77 9.94 16.66 4.42 15.08C2.91 14.64 1.36 14.38 0 14.25V13.75C1.36 13.62 2.91 13.36 4.42 12.92C9.94 11.34 14 6.23 14 0C14 6.23 18.06 11.34 23.58 12.92C25.09 13.36 26.64 13.62 28 13.75V14.25C26.64 14.38 25.09 14.64 23.58 15.08C18.06 16.66 14 21.77 14 28Z" fill="#4285F4" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Gemini CLI</span>
                  </div>
                  <button
                    onClick={() => {
                      const next = enabledProviders.includes('gemini')
                        ? enabledProviders.filter(p => p !== 'gemini')
                        : [...enabledProviders, 'gemini'] as AiProvider[]
                      void setEnabledProviders(next)
                    }}
                    className="px-3 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: enabledProviders.includes('gemini') ? 'var(--success)' : 'var(--bg-raised)',
                      color: enabledProviders.includes('gemini') ? '#1d1f21' : 'var(--text-muted)'
                    }}
                  >
                    {enabledProviders.includes('gemini') ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                {enabledProviders.includes('gemini') && (
                  <div className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Requires <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)' }}>gemini</code> in PATH
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'favorites' && (
            <div className="flex flex-col gap-2">
              {favorites.map((fav, idx) =>
                editIdx === idx ? (
                  <div key={idx}>{inlineForm}</div>
                ) : (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                    style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {fav.name}
                      </div>
                      <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {fav.path}
                      </div>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                    >
                      {fav.defaultBranch}
                    </span>
                    <button
                      onClick={() => startEdit(idx)}
                      className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removeFavorite(idx)}
                      className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              )}

              {addMode ? (
                inlineForm
              ) : (
                <button
                  onClick={startAdd}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                >
                  <Plus size={12} />
                  Add Favorite
                </button>
              )}
            </div>
          )}

          {tab === 'remotes' && (
            <div className="flex flex-col gap-2">
              {remoteHosts.map((rh, idx) =>
                editRemoteIdx === idx ? (
                  <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                    <input
                      type="text"
                      value={editRemoteForm.name}
                      onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
                      placeholder="Name (e.g. dev-server)"
                      autoFocus
                      className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteForm.host}
                      onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
                      placeholder="SSH host (e.g. user@192.168.1.100)"
                      className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <input
                      type="text"
                      value={editRemoteForm.shell}
                      onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
                      placeholder="Shell (default: /bin/bash)"
                      className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditRemoteIdx(null)}
                        className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
                        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                          const updated = [...remoteHosts]
                          updated[idx] = { ...updated[idx], name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined }
                          saveRemoteHosts(updated)
                          setEditRemoteIdx(null)
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                      >
                        <Check size={11} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={idx}>
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                      style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
                    >
                      <button
                        onClick={() => setExpandedRemote(expandedRemote === idx ? null : idx)}
                        className="p-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {expandedRemote === idx ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </button>
                      <Server size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {rh.name}
                        </div>
                        <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {rh.host}
                        </div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
                        {rh.favoriteFolders.length} favorites
                      </span>
                      <button
                        onClick={() => {
                          setEditRemoteIdx(idx)
                          setEditRemoteForm({ name: rh.name, host: rh.host, shell: rh.shell || '' })
                          setAddRemoteMode(false)
                        }}
                        className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => {
                          const updated = remoteHosts.filter((_, i) => i !== idx)
                          saveRemoteHosts(updated)
                          if (expandedRemote === idx) setExpandedRemote(null)
                        }}
                        className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Expanded: per-host favorite folders */}
                    {expandedRemote === idx && (
                      <div className="ml-6 mt-1 flex flex-col gap-1.5">
                        <div className="text-[10px] uppercase tracking-wide font-medium px-1 pt-1" style={{ color: 'var(--text-muted)' }}>
                          Favorite Folders
                        </div>
                        {rh.favoriteFolders.map((fav, fIdx) =>
                          editRemoteFavIdx === fIdx ? (
                            <div key={fIdx} className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                              <input
                                type="text"
                                value={editRemoteFavForm.name}
                                onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                                placeholder="Name"
                                autoFocus
                                className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                              />
                              <input
                                type="text"
                                value={editRemoteFavForm.path}
                                onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                                placeholder="Path"
                                className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                              />
                              <input
                                type="text"
                                value={editRemoteFavForm.defaultBranch}
                                onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                                placeholder="Default branch"
                                className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => { setEditRemoteFavIdx(null); setAddRemoteFavMode(false) }}
                                  className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                                    const updated = [...remoteHosts]
                                    const favs = [...updated[idx].favoriteFolders]
                                    if (addRemoteFavMode) {
                                      favs.push({ ...editRemoteFavForm })
                                    } else {
                                      favs[fIdx] = { ...editRemoteFavForm }
                                    }
                                    updated[idx] = { ...updated[idx], favoriteFolders: favs }
                                    saveRemoteHosts(updated)
                                    setEditRemoteFavIdx(null)
                                    setAddRemoteFavMode(false)
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                                  style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                                >
                                  <Check size={10} />
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              key={fIdx}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border"
                              style={{ borderColor: 'var(--bg-raised)', backgroundColor: 'var(--bg-primary)' }}
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{fav.name}</span>
                                <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{fav.path}</span>
                              </div>
                              <button
                                onClick={() => {
                                  setEditRemoteFavIdx(fIdx)
                                  setEditRemoteFavForm({ ...fav })
                                  setAddRemoteFavMode(false)
                                }}
                                className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={() => {
                                  const updated = [...remoteHosts]
                                  updated[idx] = { ...updated[idx], favoriteFolders: updated[idx].favoriteFolders.filter((_, i) => i !== fIdx) }
                                  saveRemoteHosts(updated)
                                }}
                                className="p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )
                        )}

                        {addRemoteFavMode && editRemoteFavIdx === null ? (
                          <div className="flex flex-col gap-1.5 p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                            <input
                              type="text"
                              value={editRemoteFavForm.name}
                              onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, name: e.target.value })}
                              placeholder="Name"
                              autoFocus
                              className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                            />
                            <input
                              type="text"
                              value={editRemoteFavForm.path}
                              onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, path: e.target.value })}
                              placeholder="Path"
                              className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                            />
                            <input
                              type="text"
                              value={editRemoteFavForm.defaultBranch}
                              onChange={(e) => setEditRemoteFavForm({ ...editRemoteFavForm, defaultBranch: e.target.value })}
                              placeholder="Default branch"
                              className="w-full px-2 py-1 rounded-md text-[11px] border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setAddRemoteFavMode(false) }}
                                className="px-2 py-0.5 rounded-md text-[10px] transition-colors duration-100"
                                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  if (!editRemoteFavForm.name.trim() || !editRemoteFavForm.path.trim()) return
                                  const updated = [...remoteHosts]
                                  const favs = [...updated[idx].favoriteFolders, { ...editRemoteFavForm }]
                                  updated[idx] = { ...updated[idx], favoriteFolders: favs }
                                  saveRemoteHosts(updated)
                                  setAddRemoteFavMode(false)
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors duration-100"
                                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                              >
                                <Check size={10} />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : !addRemoteFavMode && (
                          <button
                            onClick={() => {
                              setAddRemoteFavMode(true)
                              setEditRemoteFavIdx(null)
                              setEditRemoteFavForm({ name: '', path: '', defaultBranch: 'main' })
                            }}
                            className="flex items-center justify-center gap-1 w-full py-1.5 rounded-md border border-dashed text-[10px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                          >
                            <Plus size={10} />
                            Add Folder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {addRemoteMode ? (
                <div className="flex flex-col gap-2 p-3 rounded-lg border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)' }}>
                  <input
                    type="text"
                    value={editRemoteForm.name}
                    onChange={(e) => setEditRemoteForm({ ...editRemoteForm, name: e.target.value })}
                    placeholder="Name (e.g. dev-server)"
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editRemoteForm.host}
                    onChange={(e) => setEditRemoteForm({ ...editRemoteForm, host: e.target.value })}
                    placeholder="SSH host (e.g. user@192.168.1.100)"
                    className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="text"
                    value={editRemoteForm.shell}
                    onChange={(e) => setEditRemoteForm({ ...editRemoteForm, shell: e.target.value })}
                    placeholder="Shell (default: /bin/bash)"
                    className="w-full px-2.5 py-1.5 rounded-md text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setAddRemoteMode(false)}
                      className="px-2.5 py-1 rounded-md text-[11px] transition-colors duration-100"
                      style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!editRemoteForm.name.trim() || !editRemoteForm.host.trim()) return
                        const updated = [...remoteHosts, { name: editRemoteForm.name.trim(), host: editRemoteForm.host.trim(), shell: editRemoteForm.shell.trim() || undefined, favoriteFolders: [] }]
                        saveRemoteHosts(updated)
                        setAddRemoteMode(false)
                        setEditRemoteForm({ name: '', host: '', shell: '' })
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors duration-100"
                      style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)' }}
                    >
                      <Check size={11} />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddRemoteMode(true)
                    setEditRemoteIdx(null)
                    setEditRemoteForm({ name: '', host: '', shell: '' })
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg border border-dashed text-[11px] font-medium transition-colors duration-100 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                >
                  <Plus size={12} />
                  Add Remote Host
                </button>
              )}
            </div>
          )}

          {tab === 'appearance' && (
            <div className="flex flex-col gap-5">
              {/* Theme toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Currently {theme}
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                >
                  Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>

              {/* Zoom Factor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Zoom</div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {Math.round((zoomFactor ?? 1.0) * 100)}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={zoomFactor ?? 1.0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setZoomFactor(val)
                    window.cccAPI.window.setZoomFactor(val)
                    void window.cccAPI.config.update({ zoomFactor: val })
                  }}
                  className="w-full accent-[var(--accent)]"
                />
                <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  <span>50%</span>
                  <span>200%</span>
                </div>
              </div>

              {/* Sidebar width reset */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Sidebar Width</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Reset to default (260px)
                  </div>
                </div>
                <button
                  onClick={resetSidebarWidth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-100"
                  style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                >
                  <RotateCcw size={11} />
                  Reset
                </button>
              </div>
            </div>
          )}

          {tab === 'worktrees' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  Default Worktree Base Path
                </label>
                <input
                  type="text"
                  defaultValue={worktreeBasePath}
                  onBlur={(e) => {
                    void window.cccAPI.config.update({ worktreeBasePath: e.target.value })
                    useSessionStore.setState({ worktreeBasePath: e.target.value })
                  }}
                  placeholder="~/worktrees"
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Worktrees will be created at this path / repo name / branch name
                </p>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  Sync Paths
                </label>
                <textarea
                  defaultValue={worktreeSyncPaths.join('\n')}
                  onBlur={(e) => {
                    const paths = e.target.value.split('\n').map(p => p.trim()).filter(Boolean)
                    void window.cccAPI.config.update({ worktreeSyncPaths: paths })
                    useSessionStore.setState({ worktreeSyncPaths: paths })
                  }}
                  rows={4}
                  placeholder={".claude\nCLAUDE.md"}
                  className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)] font-mono"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)', resize: 'vertical' }}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Files and folders to copy from the source repo into new worktrees (one per line)
                </p>
              </div>
            </div>
          )}

          {tab === 'advanced' && (
            <div className="space-y-6">
              {/* IDE Command */}
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>IDE Command</h3>
                <input
                  className="w-full px-3 py-2 rounded text-sm"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  placeholder="code"
                  value={ideCommand}
                  onChange={(e) => setIdeCommand(e.target.value)}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Command to open working directory in your editor (e.g. code, cursor, rider)
                </p>
              </div>

              {/* Notifications */}
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    Show notifications when sessions finish or need input
                  </span>
                </label>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  OS notifications when app is unfocused, in-app toasts when focused
                </p>
              </div>

              {/* Skip Permissions */}
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Skip Permissions</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dangerouslySkipPermissions}
                    onChange={(e) => setDangerouslySkipPermissions(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    Pass --dangerously-skip-permissions to new Claude sessions
                  </span>
                </label>
                <p className="text-xs mt-1" style={{ color: 'var(--warning, #f59e0b)' }}>
                  Warning: This allows Claude to execute commands without confirmation
                </p>
              </div>

              {/* Claude Config Routing */}
              <div>
                <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Claude Config Routing</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  Route sessions to different Claude configurations based on working directory
                </p>

                {/* Default config dir */}
                <div className="mb-3">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Default Config Dir</label>
                  <input
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
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
                        className="flex-1 px-2 py-1 rounded text-sm"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                        placeholder="Path prefix (~/Dev/Project)"
                        value={editRouteForm.pathPrefix}
                        onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
                      />
                      <input
                        className="flex-1 px-2 py-1 rounded text-sm"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                        placeholder="Config dir (~/.claude-project)"
                        value={editRouteForm.configDir}
                        onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
                      />
                      <button
                        className="px-2 py-1 rounded text-sm"
                        style={{ background: 'var(--accent)', color: 'white' }}
                        onClick={() => {
                          const updated = [...claudeConfigRoutes]
                          updated[i] = editRouteForm
                          setClaudeConfigRoutes(updated)
                          window.cccAPI.config.update({ claudeConfigRoutes: updated })
                          setEditRouteIdx(null)
                        }}
                      >Save</button>
                      <button
                        className="px-2 py-1 rounded text-sm"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => setEditRouteIdx(null)}
                      >Cancel</button>
                    </div>
                  ) : (
                    <div key={i} className="flex items-center gap-2 mb-2 px-3 py-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{route.pathPrefix}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                      <span className="flex-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{route.configDir}</span>
                      <button
                        className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
                        style={{ color: 'var(--text-muted)' }}
                        onClick={() => { setEditRouteIdx(i); setEditRouteForm(route) }}
                      >Edit</button>
                      <button
                        className="text-xs px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
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
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                      placeholder="Path prefix (~/Dev/Project)"
                      value={editRouteForm.pathPrefix}
                      onChange={(e) => setEditRouteForm({ ...editRouteForm, pathPrefix: e.target.value })}
                    />
                    <input
                      className="flex-1 px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                      placeholder="Config dir (~/.claude-project)"
                      value={editRouteForm.configDir}
                      onChange={(e) => setEditRouteForm({ ...editRouteForm, configDir: e.target.value })}
                    />
                    <button
                      className="px-2 py-1 rounded text-sm"
                      style={{ background: 'var(--accent)', color: 'white' }}
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
                      className="px-2 py-1 rounded text-sm"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => { setAddRouteMode(false); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    className="text-sm px-3 py-1.5 rounded"
                    style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => { setAddRouteMode(true); setEditRouteForm({ pathPrefix: '', configDir: '' }) }}
                  >
                    + Add route
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'features' && (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Features</h3>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Pull Requests</span>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Monitor GitHub PRs in the sidebar</p>
                </div>
                <input
                  type="checkbox"
                  checked={featuresConfig.pullRequests}
                  onChange={(e) => saveFeatures({ ...featuresConfig, pullRequests: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
              </label>

              {featuresConfig.pullRequests && (
                <>
                  <hr style={{ borderColor: 'var(--bg-raised)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PR Configuration</h3>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>GitHub Organization</label>
                    <input
                      type="text"
                      value={prOrg}
                      onChange={(e) => setPrOrg(e.target.value)}
                      onBlur={savePrConfig}
                      className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Pinned Repos (comma-separated)</label>
                    <input
                      type="text"
                      value={prRepos}
                      onChange={(e) => setPrRepos(e.target.value)}
                      onBlur={savePrConfig}
                      className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Team Members (comma-separated usernames)</label>
                    <input
                      type="text"
                      value={prMembers}
                      onChange={(e) => setPrMembers(e.target.value)}
                      onBlur={savePrConfig}
                      className="w-full px-2 py-1.5 rounded text-xs border outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Poll Interval (seconds, 30-300)</label>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={prPollInterval}
                      onChange={(e) => setPrPollInterval(Number(e.target.value))}
                      onBlur={savePrConfig}
                      className="w-20 px-2 py-1.5 rounded text-xs border outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <label className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show my drafts</span>
                    <input type="checkbox" checked={prShowMyDrafts} onChange={(e) => { setPrShowMyDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
                  </label>

                  <label className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show others' drafts</span>
                    <input type="checkbox" checked={prShowOthersDrafts} onChange={(e) => { setPrShowOthersDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
