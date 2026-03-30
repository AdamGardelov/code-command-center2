import { useState } from 'react'
import { X, Plus, Trash2, Pencil, Check, RotateCcw } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { FavoriteFolder } from '../../shared/types'

type Tab = 'favorites' | 'appearance'

export default function SettingsModal(): React.JSX.Element {
  const settingsOpen = useSessionStore((s) => s.settingsOpen)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const favorites = useSessionStore((s) => s.favorites)
  const setFavorites = useSessionStore((s) => s.setFavorites)
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)

  const [tab, setTab] = useState<Tab>('favorites')
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
          {(['favorites', 'appearance'] as Tab[]).map((t) => (
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
