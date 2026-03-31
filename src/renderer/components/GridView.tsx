import { useCallback, useEffect, useState } from 'react'
import { useSessionStore } from '../stores/session-store'
import TerminalPanel from './TerminalPanel'

function calcCols(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 9) return 3
  return 4
}

export default function GridView(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)

  const [order, setOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    setOrder((prev) => {
      const ids = new Set(sessions.map((s) => s.id))
      const kept = prev.filter((id) => ids.has(id))
      const newIds = sessions.map((s) => s.id).filter((id) => !kept.includes(id))
      return [...kept, ...newIds]
    })
  }, [sessions])

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }, [])

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    setOrder((prev) => {
      const arr = [...prev]
      const fromIdx = arr.indexOf(dragId)
      const toIdx = arr.indexOf(targetId)
      if (fromIdx === -1 || toIdx === -1) return prev
      arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, dragId)
      return arr
    })
    setDragId(null)
    setDragOverId(null)
  }, [dragId])

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDragOverId(null)
  }, [])

  const handleDoubleClick = useCallback((id: string) => {
    setActiveSession(id)
    setViewMode('single')
  }, [setActiveSession, setViewMode])

  const visibleSessions = sessions.filter((s) => !s.isExcluded)

  const orderedSessions = order
    .map((id) => visibleSessions.find((s) => s.id === id))
    .filter(Boolean) as typeof sessions

  const cols = calcCols(orderedSessions.length)
  const rows = Math.ceil(orderedSessions.length / cols)

  return (
    <div
      className="grid-view flex-1"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`
      }}
    >
      {orderedSessions.map((session) => (
        <div
          key={session.id}
          className={`grid-card ${dragId === session.id ? 'dragging' : ''} ${dragOverId === session.id ? 'drag-over' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, session.id)}
          onDragOver={(e) => handleDragOver(e, session.id)}
          onDrop={() => handleDrop(session.id)}
          onDragEnd={handleDragEnd}
          onClick={() => setActiveSession(session.id)}
          onDoubleClick={() => handleDoubleClick(session.id)}
        >
          <div
            className="h-6 flex items-center px-2 cursor-grab active:cursor-grabbing flex-shrink-0"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            <span className="mr-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              &#x2807;
            </span>
            <span
              className={`w-[6px] h-[6px] rounded-full flex-shrink-0 mr-1.5 ${session.type === 'claude' && (session.status === 'working' || session.status === 'waiting') ? 'status-pulse' : ''}`}
              style={{
                backgroundColor: session.type === 'claude'
                  ? session.status === 'idle' ? 'var(--success)'
                  : session.status === 'working' ? 'var(--accent)'
                  : session.status === 'waiting' ? 'var(--error)'
                  : 'var(--text-muted)'
                  : 'var(--text-muted)'
              }}
            />
            <span
              className="text-[10px] font-medium truncate flex-1"
              style={{
                color: session.id === activeSessionId ? session.color : 'var(--text-secondary)'
              }}
            >
              {session.name}
            </span>
            {session.type === 'claude' && (
              <span
                className="text-[8px] font-semibold uppercase tracking-wide ml-2 flex-shrink-0"
                style={{
                  color: session.status === 'idle' ? 'var(--success)'
                    : session.status === 'working' ? 'var(--accent)'
                    : session.status === 'waiting' ? 'var(--error)'
                    : 'var(--text-muted)'
                }}
              >
                {session.status === 'idle' ? 'idle' : session.status === 'working' ? 'working' : session.status === 'waiting' ? 'input' : session.status}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 min-w-0 flex">
            <TerminalPanel session={session} />
          </div>
        </div>
      ))}
    </div>
  )
}
