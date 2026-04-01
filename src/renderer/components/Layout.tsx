import { useCallback, useRef, useState, useEffect } from 'react'
import { useSessionStore } from '../stores/session-store'
import TitleBar from './TitleBar'
import SessionTopBar from './SessionTopBar'
import SessionSidebar from './SessionSidebar'
import ActivityBar from './ActivityBar'
import PrSidebar from './PrSidebar'
import TerminalPanel from './TerminalPanel'
import EmptyState from './EmptyState'
import GridView from './GridView'
import StatusBar from './StatusBar'
import NewSessionModal from './NewSessionModal'
import SettingsModal from './SettingsModal'

export default function Layout(): React.JSX.Element {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const sidebarOpen = useSessionStore((s) => s.sidebarOpen)
  const sidebarWidth = useSessionStore((s) => s.sidebarWidth)
  const viewMode = useSessionStore((s) => s.viewMode)
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth)
  const persistSidebarWidth = useSessionStore((s) => s.persistSidebarWidth)
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const activeView = useSessionStore((s) => s.activeView)
  const features = useSessionStore((s) => s.features)
  const [hasAttention, setHasAttention] = useState(false)

  useEffect(() => {
    if (!features.pullRequests) return
    window.cccAPI.pr.getState().then((state) => {
      if (state?.attentionItems) {
        setHasAttention(state.attentionItems.length > 0)
      }
    })
    const unsubState = window.cccAPI.pr.onState((state) => {
      if (state.attentionItems) {
        setHasAttention(state.attentionItems.length > 0)
      }
    })
    const unsubNav = window.cccAPI.pr.onNavigate(() => {
      useSessionStore.getState().setActiveView('pullRequests')
    })
    return () => {
      unsubState()
      unsubNav()
    }
  }, [features.pullRequests])

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
        void persistSidebarWidth()
      }

      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth, setSidebarWidth, persistSidebarWidth]
  )

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar — always visible */}
        <ActivityBar hasAttention={hasAttention} />

        {sidebarOpen && (
          <>
            {/* Open sidebar */}
            <div
              className="overflow-hidden flex-shrink-0 flex flex-col"
              style={{
                width: sidebarWidth,
                transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
              }}
            >
              <div className="flex-1 min-h-0" style={{ width: sidebarWidth }}>
                {activeView === 'sessions' ? <SessionSidebar /> : <PrSidebar />}
              </div>
            </div>

            {/* Drag handle — thin line on the sidebar edge */}
            <div
              className="w-px flex-shrink-0 cursor-col-resize sidebar-drag-handle"
              style={{ backgroundColor: 'var(--bg-raised)' }}
              onMouseDown={handleDragStart}
            />
          </>
        )}

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-terminal)' }}>
          {sessions.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'single' && activeSession ? (
            <>
              <SessionTopBar session={activeSession} />
              <TerminalPanel key={activeSession.id} session={activeSession} />
            </>
          ) : (
            <GridView />
          )}
        </main>
      </div>

      <StatusBar />
      <NewSessionModal />
      <SettingsModal />
    </div>
  )
}
