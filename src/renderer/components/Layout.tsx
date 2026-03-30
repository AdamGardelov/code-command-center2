import { useCallback, useRef } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
        {/* Sidebar */}
        <div
          className="overflow-hidden flex-shrink-0 relative"
          style={{
            width: sidebarOpen ? sidebarWidth : 0,
            transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
          }}
        >
          <div className="h-full" style={{ width: sidebarWidth }}>
            <SessionSidebar />
          </div>
        </div>

        {/* Drag handle */}
        {sidebarOpen && (
          <div
            className="w-1 flex-shrink-0 cursor-col-resize group relative"
            style={{ backgroundColor: 'var(--bg-raised)' }}
            onMouseDown={handleDragStart}
          >
            <div
              className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent)] group-hover:opacity-30 transition-opacity duration-100"
            />
          </div>
        )}

        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute left-1 z-10 p-1 rounded transition-all duration-200"
          style={{
            top: 46,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--bg-raised)',
            color: 'var(--text-muted)',
            left: sidebarOpen ? sidebarWidth + 6 : 6,
            transition: dragging.current ? 'none' : 'left 200ms ease-in-out'
          }}
          title="Toggle sidebar (Ctrl+B)"
        >
          {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>

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
