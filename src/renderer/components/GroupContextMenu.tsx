import { useState } from 'react'
import { useSessionStore } from '../stores/session-store'

interface GroupContextMenuProps {
  sessionId: string
  x: number
  y: number
  onClose: () => void
}

export default function GroupContextMenu({ sessionId, x, y, onClose }: GroupContextMenuProps): React.JSX.Element {
  const sessionGroups = useSessionStore((s) => s.sessionGroups)
  const createGroup = useSessionStore((s) => s.createGroup)
  const addSessionToGroup = useSessionStore((s) => s.addSessionToGroup)
  const removeSessionFromGroup = useSessionStore((s) => s.removeSessionFromGroup)
  const toggleExcluded = useSessionStore(s => s.toggleExcluded)
  const openInIde = useSessionStore(s => s.openInIde)
  const ideCommand = useSessionStore(s => s.ideCommand)
  const session = useSessionStore(s => s.sessions.find(sess => sess.id === sessionId))
  const [newGroupName, setNewGroupName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const currentGroup = sessionGroups.find(g => g.sessionIds.includes(sessionId))

  const handleAddToGroup = async (groupId: string): Promise<void> => {
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    await addSessionToGroup(groupId, sessionId)
    onClose()
  }

  const handleCreateAndAdd = async (): Promise<void> => {
    if (!newGroupName.trim()) return
    const group = await createGroup(newGroupName.trim())
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    await addSessionToGroup(group.id, sessionId)
    onClose()
  }

  const handleRemove = async (): Promise<void> => {
    if (currentGroup) {
      await removeSessionFromGroup(currentGroup.id, sessionId)
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="fixed z-50 rounded-lg border py-1 min-w-[160px]"
        style={{
          left: x,
          top: y,
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        {currentGroup && (
          <button
            onClick={handleRemove}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Remove from &quot;{currentGroup.name}&quot;
          </button>
        )}

        {sessionGroups.filter(g => g.id !== currentGroup?.id).map(g => (
          <button
            key={g.id}
            onClick={() => void handleAddToGroup(g.id)}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Move to &quot;{g.name}&quot;
          </button>
        ))}

        <div style={{ height: 1, background: 'var(--border)' }} />
        <button
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => { toggleExcluded(sessionId); onClose() }}
        >
          {session?.isExcluded ? 'Include session' : 'Exclude session'}
        </button>
        {ideCommand && !session?.remoteHost && (
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={() => { openInIde(sessionId); onClose() }}
          >
            Open in IDE
          </button>
        )}

        <div className="border-t my-1" style={{ borderColor: 'var(--bg-raised)' }} />

        {showNew ? (
          <div className="px-2 py-1 flex gap-1">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreateAndAdd()}
              placeholder="Group name"
              autoFocus
              className="flex-1 px-2 py-1 rounded text-[11px] border outline-none"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--bg-raised)]"
            style={{ color: 'var(--accent)' }}
          >
            New group...
          </button>
        )}
      </div>
    </>
  )
}
