import { useState } from 'react'
import { X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'

export default function NewSessionModal(): React.JSX.Element {
  const modalOpen = useSessionStore((s) => s.modalOpen)
  const toggleModal = useSessionStore((s) => s.toggleModal)
  const createSession = useSessionStore((s) => s.createSession)
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')

  if (!modalOpen) return <></>

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!name.trim() || !workingDirectory.trim()) return
    createSession({ name: name.trim(), workingDirectory: workingDirectory.trim() })
    setName('')
    setWorkingDirectory('')
    toggleModal()
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleModal()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api-server"
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div>
            <label
              className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Working Directory
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="e.g. ~/projects/my-app"
              className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--bg-raised)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={toggleModal}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--bg-raised)',
                color: 'var(--text-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors duration-100"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)'
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
