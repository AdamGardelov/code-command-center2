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
  const viewMode = useSessionStore((s) => s.viewMode)
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div className="h-screen w-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="transition-all duration-200 ease-in-out overflow-hidden flex-shrink-0"
          style={{ width: sidebarOpen ? 260 : 0 }}
        >
          <div className="w-[260px] h-full">
            <SessionSidebar />
          </div>
        </div>

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
