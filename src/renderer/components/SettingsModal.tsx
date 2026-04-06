import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import SettingsSidebar, { type Tab } from './settings/SettingsSidebar'
import AppearanceSettings from './settings/AppearanceSettings'
import FeaturesSettings from './settings/FeaturesSettings'
import ProvidersSettings from './settings/ProvidersSettings'
import FavoritesSettings from './settings/FavoritesSettings'
import WorktreesSettings from './settings/WorktreesSettings'
import RemotesSettings from './settings/RemotesSettings'
import ContainersSettings from './settings/ContainersSettings'
import AdvancedSettings from './settings/AdvancedSettings'
import GridSettings from './settings/GridSettings'
import { AboutTab } from './AboutTab'

const TAB_TITLES: Record<Tab, string> = {
  appearance: 'Appearance',
  grid: 'Grid',
  features: 'Features',
  providers: 'AI Providers',
  favorites: 'Favorites',
  worktrees: 'Worktrees',
  remotes: 'Remote Hosts',
  containers: 'Containers',
  advanced: 'Advanced',
  about: 'About',
}

const TAB_COMPONENTS: Record<Tab, React.ComponentType> = {
  appearance: AppearanceSettings,
  grid: GridSettings,
  features: FeaturesSettings,
  providers: ProvidersSettings,
  favorites: FavoritesSettings,
  worktrees: WorktreesSettings,
  remotes: RemotesSettings,
  containers: ContainersSettings,
  advanced: AdvancedSettings,
  about: AboutTab,
}

export default function SettingsModal(): React.JSX.Element {
  const settingsOpen = useSessionStore((s) => s.settingsOpen)
  const settingsInitialTab = useSessionStore((s) => s.settingsInitialTab)
  const toggleSettings = useSessionStore((s) => s.toggleSettings)
  const [tab, setTab] = useState<Tab>('appearance')

  useEffect(() => {
    if (settingsOpen && settingsInitialTab) {
      setTab(settingsInitialTab as Tab)
    }
  }, [settingsOpen, settingsInitialTab])

  if (!settingsOpen) return <></>

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) toggleSettings()
  }

  const ActiveTab = TAB_COMPONENTS[tab]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'var(--modal-backdrop)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-[720px] h-[80vh] flex rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--bg-raised)',
          animation: 'modal-enter 150ms ease'
        }}
      >
        {/* Sidebar */}
        <SettingsSidebar activeTab={tab} onTabChange={setTab} />

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {TAB_TITLES[tab]}
            </h2>
            <button
              onClick={toggleSettings}
              className="p-1 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  )
}
