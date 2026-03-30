import { useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
        {/* Sidebar + drag handle + toggle */}
        <div
          className="flex-shrink-0 flex"
          style={{
            width: sidebarOpen ? sidebarWidth + 16 : 16,
            transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
          }}
        >
          {/* Sidebar content */}
          <div
            className="overflow-hidden"
            style={{
              width: sidebarOpen ? sidebarWidth : 0,
              transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
            }}
          >
            <div className="h-full" style={{ width: sidebarWidth }}>
              <SessionSidebar />
            </div>
          </div>

          {/* Drag handle + collapse button column */}
          <div className="w-4 flex-shrink-0 flex flex-col items-center relative"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            {/* Drag handle (only when sidebar open) */}
            {sidebarOpen && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--accent)] hover:opacity-50 transition-opacity duration-100"
                style={{ backgroundColor: 'var(--bg-raised)' }}
                onMouseDown={handleDragStart}
              />
            )}

            {/* Toggle button */}
            <button
              onClick={toggleSidebar}
              className="mt-2 p-0.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
              title="Toggle sidebar (Ctrl+B)"
            >
              {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
          </div>
        </div>

        {/* Main area */}
        <main className="flex-1 flex overflow-hidden">
          {sessions.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'single' && activeSession ? (
            <div className="flex-1 p-1">
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
