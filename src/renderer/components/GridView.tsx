import { useCallback, useEffect, useRef } from 'react'
import { RotateCcw } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import { buildAutoGrid, updateRatio, collectSessionIds, removeSession, addSession } from '../lib/split-tree'
import SplitPane from './SplitPane'

export default function GridView(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const gridLayout = useSessionStore((s) => s.gridLayout)
  const setGridLayout = useSessionStore((s) => s.setGridLayout)
  const persistGridLayout = useSessionStore((s) => s.persistGridLayout)
  const resetGridLayout = useSessionStore((s) => s.resetGridLayout)

  const visibleSessions = sessions.filter((s) => !s.isExcluded)
  const visibleIds = new Set(visibleSessions.map((s) => s.id))
  const prevVisibleIdsRef = useRef<Set<string>>(visibleIds)

  // Sync layout with session changes
  useEffect(() => {
    prevVisibleIdsRef.current = visibleIds

    if (visibleSessions.length === 0) {
      if (gridLayout !== null) setGridLayout(null)
      return
    }

    // No layout yet — build auto grid
    if (gridLayout === null) {
      setGridLayout(buildAutoGrid(visibleSessions.map((s) => s.id)))
      return
    }

    const treeIds = new Set(collectSessionIds(gridLayout))

    // Find added and removed sessions
    const added = visibleSessions.filter((s) => !treeIds.has(s.id))
    const removedIds = [...treeIds].filter((id) => !visibleIds.has(id))

    if (added.length === 0 && removedIds.length === 0) return

    let newLayout = gridLayout
    // Remove sessions that are no longer visible
    for (const id of removedIds) {
      const result = removeSession(newLayout, id)
      if (result === null) {
        setGridLayout(null)
        return
      }
      newLayout = result
    }
    // Add new sessions
    for (const s of added) {
      newLayout = addSession(newLayout, s.id)
    }
    setGridLayout(newLayout)
  }, [visibleSessions.length, ...visibleSessions.map((s) => s.id)])

  const handleRatioChange = useCallback(
    (path: number[], ratio: number) => {
      if (!gridLayout || gridLayout.type !== 'split') return
      const newLayout = updateRatio(gridLayout, path, ratio)
      setGridLayout(newLayout)
    },
    [gridLayout, setGridLayout]
  )

  const handleDragEnd = useCallback(() => {
    void persistGridLayout()
  }, [persistGridLayout])

  const handleDoubleClick = useCallback(
    (id: string) => {
      setActiveSession(id)
      setViewMode('single')
    },
    [setActiveSession, setViewMode]
  )

  if (!gridLayout || visibleSessions.length === 0) {
    return <div className="flex-1" style={{ backgroundColor: 'var(--bg-primary)' }} />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div
        className="h-7 flex items-center justify-end px-2 flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--bg-raised)' }}
      >
        <button
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          onClick={resetGridLayout}
          title="Reset layout"
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>
      {/* Split tree */}
      <div className="flex-1 min-h-0 flex">
        <SplitPane
          node={gridLayout}
          sessions={visibleSessions}
          path={[]}
          onRatioChange={handleRatioChange}
          onDragEnd={handleDragEnd}
          onActivate={setActiveSession}
          onDoubleClick={handleDoubleClick}
          activeSessionId={activeSessionId}
        />
      </div>
    </div>
  )
}
