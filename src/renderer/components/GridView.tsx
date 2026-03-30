import { useCallback, useRef } from 'react'
import { WidthProvider } from 'react-grid-layout'
import ReactGridLayout from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useSessionStore } from '../stores/session-store'
import TerminalPanel from './TerminalPanel'

const GridLayout = WidthProvider(ReactGridLayout)

export default function GridView(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const gridLayout = useSessionStore((s) => s.gridLayout)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)
  const updateGridLayout = useSessionStore((s) => s.updateGridLayout)

  const cols = sessions.length <= 2 ? sessions.length || 1 : sessions.length <= 4 ? 2 : 3

  const handleLayoutChange = useCallback(
    (layout: Layout[]) => {
      updateGridLayout(
        layout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h
        }))
      )
    },
    [updateGridLayout]
  )

  const handleDoubleClick = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId)
      setViewMode('single')
    },
    [setActiveSession, setViewMode]
  )

  const rowHeight = Math.floor(
    ((containerRef.current?.clientHeight ?? 400) / Math.ceil(sessions.length / cols)) - 12
  )

  return (
    <div ref={containerRef} className="flex-1 h-full p-1 overflow-auto">
      <GridLayout
        layout={gridLayout}
        cols={cols}
        rowHeight={rowHeight}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".grid-drag-handle"
        isResizable={true}
        isDraggable={true}
        margin={[6, 6] as [number, number]}
        containerPadding={[0, 0] as [number, number]}
      >
        {sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-md overflow-hidden border transition-colors duration-100"
            style={{
              borderColor:
                session.id === activeSessionId ? 'var(--accent)' : 'var(--bg-raised)'
            }}
            onClick={() => setActiveSession(session.id)}
            onDoubleClick={() => handleDoubleClick(session.id)}
          >
            <div
              className="grid-drag-handle h-6 flex items-center px-2 cursor-grab active:cursor-grabbing border-b"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--bg-raised)'
              }}
            >
              <span
                className="mr-2 text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                &#x2807;
              </span>
              <span
                className="text-[10px] font-medium truncate"
                style={{
                  color:
                    session.id === activeSessionId
                      ? 'var(--accent)'
                      : 'var(--text-secondary)'
                }}
              >
                {session.name}
              </span>
            </div>
            <div className="h-[calc(100%-24px)]">
              <TerminalPanel session={session} />
            </div>
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
