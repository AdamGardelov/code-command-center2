import { useState } from 'react'
import { X, Plus, Trash2, Pencil, Check, RotateCcw, Bot, Sparkles } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { FavoriteFolder, AiProvider } from '../../shared/types'

type Tab = 'providers' | 'favorites' | 'appearance'

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

  const [tab, setTab] = useState<Tab>('providers')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addMode, setAddMode] = useState(false)

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
          {(['providers', 'favorites', 'appearance'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-[11px] font-medium transition-colors duration-100 border-b-2"
              style={{
                borderColor: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
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
        </div>
      </div>
    </div>
  )
}
