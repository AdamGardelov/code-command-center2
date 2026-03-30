import { useCallback, useRef } from 'react'
import { PanelLeftOpen } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import TitleBar from './TitleBar'
import SessionSidebar from './SessionSidebar'
import TerminalPanel from './TerminalPanel'
import EmptyState from './EmptyState'
import GridView from './GridView'
import StatusBar from './StatusBar'
import NewSessionModal from './NewSessionModal'

export default function Layout(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sidebarOpen = useSessionStore((s) => s.sidebarOpen)
  const sidebarWidth = useSessionStore((s) => s.sidebarWidth)
  const viewMode = useSessionStore((s) => s.viewMode)
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth

      const handleDragMove = (ev: MouseEvent): void => {
        if (!dragging.current) return
        const delta = ev.clientX - startX.current
        setSidebarWidth(startWidth.current + delta)
      }

      const handleDragEnd = (): void => {
        dragging.current = false
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth, setSidebarWidth]
  )

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen ? (
          <>
            {/* Open sidebar */}
            <div
              className="overflow-hidden flex-shrink-0"
              style={{
                width: sidebarWidth,
                transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
              }}
            >
              <div className="h-full" style={{ width: sidebarWidth }}>
                <SessionSidebar />
              </div>
            </div>

            {/* Drag handle — thin line on the sidebar edge */}
            <div
              className="w-px flex-shrink-0 cursor-col-resize sidebar-drag-handle"
              style={{ backgroundColor: 'var(--bg-raised)' }}
              onMouseDown={handleDragStart}
            />
          </>
        ) : (
          /* Collapsed sidebar — narrow strip with expand button */
          <div
            className="w-8 flex-shrink-0 flex flex-col items-center pt-2 border-r"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-raised)'
            }}
          >
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}

        {/* Main area */}
        <main className="flex-1 flex overflow-hidden">
          {sessions.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'single' && activeSession ? (
            <div className="flex-1">
              <TerminalPanel key={activeSession.id} session={activeSession} />
            </div>
          ) : (
            <GridView />
          )}
        </main>
      </div>

      <StatusBar />
      <NewSessionModal />
    </div>
  )
}
