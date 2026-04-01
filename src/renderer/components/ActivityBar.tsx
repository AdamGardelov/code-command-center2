import { SquareTerminal, GitPullRequestArrow, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { ActiveView } from '../../shared/types'

interface ActivityBarItemProps {
  icon: React.ReactNode
  view: ActiveView
  active: boolean
  onClick: () => void
  badge?: boolean
  tooltip: string
}

function ActivityBarItem({ icon, active, onClick, badge, tooltip }: ActivityBarItemProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="relative flex items-center justify-center rounded transition-colors duration-100"
      style={{
        width: 28,
        height: 28,
        backgroundColor: active ? 'rgba(233,200,128,0.15)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {icon}
      {badge && (
        <div
          className="absolute rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'var(--accent)',
            top: -1,
            right: -1,
          }}
        />
      )}
    </button>
  )
}

export default function ActivityBar({ hasAttention }: { hasAttention: boolean }): React.JSX.Element {
  const activeView = useSessionStore((s) => s.activeView)
  const features = useSessionStore((s) => s.features)
  const sidebarOpen = useSessionStore((s) => s.sidebarOpen)
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const setActiveView = useSessionStore((s) => s.setActiveView)

  return (
    <div
      className="flex flex-col items-center pt-2 pb-2 gap-1 flex-shrink-0"
      style={{
        width: 36,
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--bg-raised)',
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
        className="flex items-center justify-center rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
        style={{
          width: 28,
          height: 28,
          color: 'var(--text-muted)',
        }}
      >
        {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
      </button>

      {/* Separator */}
      <div
        style={{
          width: 18,
          height: 1,
          backgroundColor: 'var(--bg-raised)',
          marginTop: 2,
          marginBottom: 2,
        }}
      />

      {/* Nav items */}
      <ActivityBarItem
        icon={<SquareTerminal size={16} />}
        view="sessions"
        active={activeView === 'sessions'}
        onClick={() => setActiveView('sessions')}
        tooltip="Sessions"
      />
      {features.pullRequests && (
        <ActivityBarItem
          icon={<GitPullRequestArrow size={16} />}
          view="pullRequests"
          active={activeView === 'pullRequests'}
          onClick={() => setActiveView('pullRequests')}
          badge={hasAttention}
          tooltip="Pull Requests"
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <button
        onClick={toggleSettings}
        title="Settings"
        className="flex items-center justify-center rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
        style={{
          width: 28,
          height: 28,
          color: 'var(--text-muted)',
        }}
      >
        <Settings size={15} />
      </button>
    </div>
  )
}
