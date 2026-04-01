import { Sun, Zap, LayoutGrid, Monitor, Folder, GitBranch, Server, Box, Settings } from 'lucide-react'

export type Tab = 'appearance' | 'grid' | 'features' | 'providers' | 'favorites' | 'worktrees' | 'remotes' | 'containers' | 'advanced'

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
    ],
  },
]

export default function SettingsSidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }): React.JSX.Element {
  return (
    <div
      className="w-[180px] flex-shrink-0 border-r overflow-y-auto py-4 px-2.5"
      style={{ borderColor: 'var(--bg-raised)' }}
    >
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div
            className="text-[9px] uppercase tracking-[1.2px] font-semibold px-2.5 pt-3 pb-1.5 first:pt-0"
            style={{ color: 'var(--text-muted)' }}
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
                className="flex items-center gap-2.5 w-full px-2.5 py-[6px] rounded-md text-xs transition-colors duration-100"
                style={{
                  backgroundColor: isActive ? 'var(--bg-raised)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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
