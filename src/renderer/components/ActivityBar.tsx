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
      className="relative flex items-center justify-center transition-colors duration-100"
      style={{
        width: 30,
        height: 30,
        borderRadius: 6,
        backgroundColor: active ? 'var(--amber-wash)' : 'transparent',
        color: active ? 'var(--amber)' : 'var(--ink-3)'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--bg-2)'
          e.currentTarget.style.color = 'var(--ink-1)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--ink-3)'
        }
      }}
    >
      {/* Left-rail accent line on active */}
      {active && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: -6,
            top: 6,
            bottom: 6,
            width: 2,
            borderRadius: '0 2px 2px 0',
            backgroundColor: 'var(--amber)'
          }}
        />
      )}
      {icon}
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'var(--amber)'
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
      className="flex flex-col items-center flex-shrink-0"
      style={{
        width: 40,
        padding: '6px 0',
        gap: 2,
        backgroundColor: 'var(--bg-0)',
        borderRight: '1px solid var(--line)'
      }}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
        className="flex items-center justify-center transition-colors duration-100"
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          color: 'var(--ink-3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-2)'
          e.currentTarget.style.color = 'var(--ink-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--ink-3)'
        }}
      >
        {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
      </button>

      <div
        aria-hidden
        style={{
          width: 20,
          height: 1,
          backgroundColor: 'var(--line)',
          margin: '4px 0'
        }}
      />

      <ActivityBarItem
        icon={<SquareTerminal size={16} />}
        view="sessions"
        active={activeView === 'sessions'}
        onClick={() => setActiveView('sessions')}
        tooltip="Sessions"
      />
      {features.pullRequests && (
        <ActivityBarItem
          icon={<GitPullRequestArrow size={15} />}
          view="pullRequests"
          active={activeView === 'pullRequests'}
          onClick={() => setActiveView('pullRequests')}
          badge={hasAttention}
          tooltip="Pull Requests"
        />
      )}

      <div className="flex-1" />

      <button
        onClick={toggleSettings}
        title="Settings"
        className="flex items-center justify-center transition-colors duration-100"
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          color: 'var(--ink-3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-2)'
          e.currentTarget.style.color = 'var(--ink-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = 'var(--ink-3)'
        }}
      >
        <Settings size={15} />
      </button>
    </div>
  )
}
