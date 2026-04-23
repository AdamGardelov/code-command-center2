import { Sun, Zap, LayoutGrid, Monitor, Folder, GitBranch, Server, Box, Settings, Info } from 'lucide-react'

export type Tab = 'appearance' | 'grid' | 'features' | 'providers' | 'favorites' | 'worktrees' | 'remotes' | 'containers' | 'advanced' | 'about'

interface NavItem {
  id: Tab
  label: string
  icon: React.ComponentType<{ size?: number }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'General',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Sun },
      { id: 'grid', label: 'Grid', icon: LayoutGrid },
      { id: 'features', label: 'Features', icon: Zap },
    ],
  },
  {
    label: 'Sessions',
    items: [
      { id: 'providers', label: 'AI Providers', icon: Monitor },
      { id: 'favorites', label: 'Favorites', icon: Folder },
      { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
    ],
  },
  {
    label: 'Connections',
    items: [
      { id: 'remotes', label: 'Remote Hosts', icon: Server },
      { id: 'containers', label: 'Containers', icon: Box },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'advanced', label: 'Advanced', icon: Settings },
      { id: 'about', label: 'About', icon: Info },
    ],
  },
]

export default function SettingsSidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }): React.JSX.Element {
  return (
    <div
      className="w-[180px] flex-shrink-0 overflow-y-auto ccc-scroll"
      style={{
        backgroundColor: 'var(--bg-0)',
        borderRight: '1px solid var(--line)',
        padding: '18px 10px'
      }}
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              padding: '12px 10px 6px'
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="flex items-center w-full transition-colors duration-100"
                style={{
                  gap: 8,
                  padding: '7px 10px',
                  border: 'none',
                  borderRadius: 6,
                  backgroundColor: isActive ? 'var(--amber-wash)' : 'transparent',
                  color: isActive ? 'var(--amber)' : 'var(--ink-2)',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-2)'
                    e.currentTarget.style.color = 'var(--ink-1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--ink-2)'
                  }
                }}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
