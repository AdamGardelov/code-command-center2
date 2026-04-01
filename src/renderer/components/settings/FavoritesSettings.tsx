import { useState } from 'react'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useSessionStore } from '../../stores/session-store'
import type { FavoriteFolder } from '../../../shared/types'

export default function FavoritesSettings(): React.JSX.Element {
  const favorites = useSessionStore((s) => s.favorites)
  const setFavorites = useSessionStore((s) => s.setFavorites)

  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FavoriteFolder>({ name: '', path: '', defaultBranch: 'main' })
  const [addMode, setAddMode] = useState(false)

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
    if (editIdx === idx) setEditIdx(null)
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
  )
}
