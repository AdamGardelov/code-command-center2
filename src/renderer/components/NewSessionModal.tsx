import { useState } from 'react'
import { X, Terminal, Bot } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { SessionType } from '../../shared/types'

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const favorites = useSessionStore((s) => s.favorites)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')
  const [type, setType] = useState<SessionType>('claude')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!modalOpen) return <></>

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || creating) return
    if (type === 'claude' && !workingDirectory.trim()) return

    setCreating(true)
    setError(null)

    try {
      await createSession({
        name: name.trim(),
        workingDirectory: workingDirectory.trim() || '~',
        type
      })
      setName('')
      setWorkingDirectory('')
      setType('claude')
      toggleModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    } finally {
      setCreating(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget && !creating) toggleModal()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[420px] rounded-xl border p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            New Session
          </h2>
          <button
            onClick={toggleModal}
            className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {favorites.length > 0 && (
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Favorites
            </label>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((fav, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { setName(fav.name); setWorkingDirectory(fav.path) }}
                  className="px-2.5 py-1.5 rounded-md text-[11px] border transition-colors duration-100 hover:border-[var(--accent)]"
                  style={{
                    borderColor: name === fav.name && workingDirectory === fav.path ? 'var(--accent)' : 'var(--bg-raised)',
                    backgroundColor: name === fav.name && workingDirectory === fav.path ? 'var(--accent-muted)' : 'var(--bg-primary)',
                    color: name === fav.name && workingDirectory === fav.path ? 'var(--accent)' : 'var(--text-secondary)'
                  }}
                >
                  {fav.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {favorites.length === 0 && (
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => { toggleModal(); toggleSettings() }}
              className="text-[10px] transition-colors hover:underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Add favorite repos in Settings
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('claude')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                style={{
                  backgroundColor: type === 'claude' ? 'var(--accent-muted)' : 'transparent',
                  borderColor: type === 'claude' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: type === 'claude' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                <Bot size={14} />
                Claude
              </button>
              <button
                type="button"
                onClick={() => setType('shell')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-100"
                style={{
                  backgroundColor: type === 'shell' ? 'var(--accent-muted)' : 'transparent',
                  borderColor: type === 'shell' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: type === 'shell' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                <Terminal size={14} />
                Shell
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api-server"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
              Working Directory
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="e.g. ~/projects/my-app"
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <p className="text-[11px]" style={{ color: 'var(--error)' }}>{error}</p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={toggleModal}
              disabled={creating}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-primary)', opacity: creating ? 0.6 : 1 }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
