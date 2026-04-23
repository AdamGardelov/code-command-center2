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
      style={{
        backgroundColor: 'var(--modal-backdrop)',
        backdropFilter: 'blur(3px)',
        animation: 'modal-fade 160ms ease'
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="flex overflow-hidden"
        style={{
          width: 720,
          height: '80vh',
          backgroundColor: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-modal)',
          animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
      >
        <SettingsSidebar activeTab={tab} onTabChange={setTab} />

        <div className="flex-1 flex flex-col min-w-0">
          <div
            className="flex items-center justify-between flex-shrink-0"
            style={{ padding: '22px 26px 16px' }}
          >
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink-0)',
                letterSpacing: '-0.005em',
                margin: 0
              }}
            >
              {TAB_TITLES[tab]}
            </h2>
            <button
              onClick={toggleSettings}
              className="flex items-center justify-center rounded transition-colors duration-100"
              style={{ width: 24, height: 24, color: 'var(--ink-3)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-2)'
                e.currentTarget.style.color = 'var(--ink-0)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--ink-3)'
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto ccc-scroll" style={{ padding: '0 26px 26px' }}>
            <ActiveTab />
          </div>
        </div>
      </div>
    </div>
  )
}
