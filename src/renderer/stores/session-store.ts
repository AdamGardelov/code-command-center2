import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder, AiProvider, RemoteHost, SessionGroup, ActiveView, FeaturesConfig, ContainerConfig, SplitNode } from '../../shared/types'
import { removeSession as removeFromTree, buildAutoGrid } from '../lib/split-tree'

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  viewMode: ViewMode
  sidebarOpen: boolean
  sidebarWidth: number
  modalOpen: boolean
  theme: Theme
  loading: boolean
  settingsOpen: boolean
  favorites: FavoriteFolder[]
  enabledProviders: AiProvider[]
  hostStatuses: Record<string, boolean>
  remoteHosts: RemoteHost[]
  sessionGroups: SessionGroup[]
  worktreeBasePath: string
  worktreeSyncPaths: string[]
  excludedSessions: string[]
  mutedSessions: string[]
  notificationsEnabled: boolean
  dangerouslySkipPermissions: boolean
  ideCommand: string
  activeView: ActiveView
  features: FeaturesConfig
  containers: ContainerConfig[]
  enableContainers: boolean
  platform: string
  gridLayout: SplitNode | null
  gridPresets: Record<string, string>
  setGridLayout: (layout: SplitNode | null) => void
  setGridPresets: (presets: Record<string, string>) => void
  persistGridLayout: () => Promise<void>
  resetGridLayout: () => void
  setActiveView: (view: ActiveView) => void

  loadConfig: () => Promise<void>
  createGroup: (name: string) => Promise<SessionGroup>
  deleteGroup: (groupId: string) => Promise<void>
  addSessionToGroup: (groupId: string, sessionId: string) => Promise<void>
  removeSessionFromGroup: (groupId: string, sessionId: string) => Promise<void>
  toggleExcluded: (sessionId: string) => Promise<void>
  toggleMuted: (sessionId: string) => Promise<void>
  setNotificationsEnabled: (value: boolean) => Promise<void>
  setDangerouslySkipPermissions: (value: boolean) => Promise<void>
  setIdeCommand: (value: string) => Promise<void>
  openInIde: (sessionId: string) => Promise<void>
  openFolder: (sessionId: string) => Promise<void>
  getGroupedSessions: () => {
    groups: Array<{ group: SessionGroup | { id: string; name: string; auto: true }; sessionIds: string[] }>
    ungrouped: string[]
  }
  loadSessions: () => Promise<void>
  createSession: (opts: SessionCreate) => Promise<void>
  removeSession: (id: string) => Promise<void>
  setActiveSession: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleModal: () => void
  toggleTheme: () => void
  toggleSettings: () => void
  setFavorites: (favoriteFolders: FavoriteFolder[]) => Promise<void>
  setRemoteHosts: (remoteHosts: RemoteHost[]) => Promise<void>
  setEnabledProviders: (providers: AiProvider[]) => Promise<void>
  setContainers: (containers: ContainerConfig[]) => Promise<void>
  setEnableContainers: (value: boolean) => Promise<void>
  persistSidebarWidth: () => Promise<void>
  updateSessionStatus: (sessionName: string, status: SessionStatus) => void
  loadHostStatuses: () => Promise<void>
  updateHostStatus: (name: string, online: boolean) => void
  nextSession: () => void
  prevSession: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  viewMode: 'single',
  sidebarOpen: true,
  sidebarWidth: 260,
  modalOpen: false,
  theme: 'dark',
  loading: true,
  settingsOpen: false,
  enabledProviders: ['claude'] as AiProvider[],
  favorites: [],
  hostStatuses: {},
  remoteHosts: [],
  sessionGroups: [],
  worktreeBasePath: '~/worktrees',
  worktreeSyncPaths: ['.claude', 'CLAUDE.md'],
  excludedSessions: [],
  mutedSessions: [],
  notificationsEnabled: true,
  dangerouslySkipPermissions: false,
  ideCommand: '',
  activeView: 'sessions' as ActiveView,
  features: { pullRequests: false } as FeaturesConfig,
  containers: [],
  enableContainers: false,
  platform: '',
  gridLayout: null,
  gridPresets: {},

  loadConfig: async () => {
    const platform = await window.cccAPI.app.platform()
    set({ platform })
    const config = await window.cccAPI.config.load()
    document.documentElement.setAttribute('data-theme', config.theme)
    if (config.zoomFactor && config.zoomFactor !== 1.0) {
      window.cccAPI.window.setZoomFactor(config.zoomFactor)
    }
    set({
      theme: config.theme,
      sidebarWidth: config.sidebarWidth,
      favorites: config.favoriteFolders,
      enabledProviders: config.enabledProviders ?? ['claude'],
      remoteHosts: config.remoteHosts ?? [],
      sessionGroups: config.sessionGroups ?? [],
      worktreeBasePath: config.worktreeBasePath ?? '~/worktrees',
      worktreeSyncPaths: config.worktreeSyncPaths ?? ['.claude', 'CLAUDE.md'],
      excludedSessions: config.excludedSessions ?? [],
      mutedSessions: config.mutedSessions ?? [],
      notificationsEnabled: config.notificationsEnabled !== false,
      dangerouslySkipPermissions: config.dangerouslySkipPermissions ?? false,
      ideCommand: config.ideCommand ?? '',
      features: config.features ?? { pullRequests: false },
      containers: config.containers ?? [],
      enableContainers: config.features?.containers ?? false,
      gridLayout: config.gridLayout ?? null,
      gridPresets: config.gridPresets ?? {},
    })
  },

  loadSessions: async () => {
    const sessions = await window.cccAPI.session.list()
    const excluded = get().excludedSessions
    const marked = sessions.map((s: Session) => ({
      ...s,
      isExcluded: excluded.includes(s.name)
    }))
    set((state) => ({
      sessions: marked,
      loading: false,
      activeSessionId: state.activeSessionId && sessions.find(s => s.id === state.activeSessionId)
        ? state.activeSessionId
        : sessions[0]?.id ?? null
    }))
  },

  createSession: async (opts) => {
    const session = await window.cccAPI.session.create(opts)
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id
    }))
  },

  removeSession: async (id) => {
    await window.cccAPI.session.kill(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const gridLayout = state.gridLayout ? removeFromTree(state.gridLayout, id) : null
      return {
        sessions,
        gridLayout,
        activeSessionId:
          state.activeSessionId === id
            ? sessions[0]?.id ?? null
            : state.activeSessionId
      }
    })
    void get().persistGridLayout()
  },

  setActiveSession: (id) => set({ activeSessionId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),
  toggleModal: () => set((state) => ({ modalOpen: !state.modalOpen })),
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    void window.cccAPI.config.update({ theme: next })
    return { theme: next }
  }),
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  setFavorites: async (favoriteFolders) => {
    await window.cccAPI.config.update({ favoriteFolders })
    set({ favorites: favoriteFolders })
  },
  setRemoteHosts: async (remoteHosts) => {
    await window.cccAPI.config.update({ remoteHosts })
    set({ remoteHosts })
  },
  setEnabledProviders: async (providers) => {
    await window.cccAPI.config.update({ enabledProviders: providers })
    set({ enabledProviders: providers })
  },
  setContainers: async (containers) => {
    await window.cccAPI.config.update({ containers })
    set({ containers })
  },
  setEnableContainers: async (value) => {
    const features = { ...get().features, containers: value }
    await window.cccAPI.config.update({ features })
    set({ features, enableContainers: value })
  },
  persistSidebarWidth: async () => {
    const { sidebarWidth } = get()
    await window.cccAPI.config.update({ sidebarWidth })
  },

  loadHostStatuses: async () => {
    const statuses = await window.cccAPI.host.statuses()
    set({ hostStatuses: statuses })
  },

  updateHostStatus: (name, online) => {
    set((state) => ({
      hostStatuses: { ...state.hostStatuses, [name]: online }
    }))
  },

  updateSessionStatus: (sessionName, status) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.name === sessionName ? { ...s, status } : s
      )
    }))
  },

  nextSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const next = (idx + 1) % sessions.length
    set({ activeSessionId: sessions[next].id })
  },

  prevSession: () => {
    const { sessions, activeSessionId } = get()
    if (sessions.length === 0) return
    const idx = sessions.findIndex((s) => s.id === activeSessionId)
    const prev = (idx - 1 + sessions.length) % sessions.length
    set({ activeSessionId: sessions[prev].id })
  },

  createGroup: async (name) => {
    const group = await window.cccAPI.group.create(name)
    set((state) => ({ sessionGroups: [...state.sessionGroups, group] }))
    return group
  },

  deleteGroup: async (groupId) => {
    await window.cccAPI.group.delete(groupId)
    set((state) => ({
      sessionGroups: state.sessionGroups.filter(g => g.id !== groupId)
    }))
  },

  addSessionToGroup: async (groupId, sessionId) => {
    await window.cccAPI.group.addSession(groupId, sessionId)
    set((state) => ({
      sessionGroups: state.sessionGroups.map(g =>
        g.id === groupId && !g.sessionIds.includes(sessionId)
          ? { ...g, sessionIds: [...g.sessionIds, sessionId] }
          : g
      )
    }))
  },

  removeSessionFromGroup: async (groupId, sessionId) => {
    await window.cccAPI.group.removeSession(groupId, sessionId)
    set((state) => ({
      sessionGroups: state.sessionGroups.map(g =>
        g.id === groupId
          ? { ...g, sessionIds: g.sessionIds.filter(id => id !== sessionId) }
          : g
      )
    }))
  },

  toggleMuted: async (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return
    await window.cccAPI.config.toggleMuted(session.name)
    const isMuted = get().mutedSessions.includes(session.name)
    set({
      mutedSessions: isMuted
        ? get().mutedSessions.filter(n => n !== session.name)
        : [...get().mutedSessions, session.name]
    })
  },

  setNotificationsEnabled: async (value: boolean) => {
    await window.cccAPI.config.update({ notificationsEnabled: value })
    set({ notificationsEnabled: value })
  },

  toggleExcluded: async (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return
    await window.cccAPI.config.toggleExcluded(session.name)
    set({
      sessions: get().sessions.map(s =>
        s.id === sessionId ? { ...s, isExcluded: !s.isExcluded } : s
      ),
      excludedSessions: get().sessions.find(s => s.id === sessionId)?.isExcluded
        ? get().excludedSessions.filter(n => n !== session.name)
        : [...get().excludedSessions, session.name]
    })
  },

  setDangerouslySkipPermissions: async (value: boolean) => {
    await window.cccAPI.config.update({ dangerouslySkipPermissions: value })
    set({ dangerouslySkipPermissions: value })
  },

  setIdeCommand: async (value: string) => {
    await window.cccAPI.config.update({ ideCommand: value || undefined })
    set({ ideCommand: value })
  },

  setGridLayout: (layout) => set({ gridLayout: layout }),

  setGridPresets: (presets) => {
    set({ gridPresets: presets })
    void window.cccAPI.config.update({ gridPresets: presets })
  },

  persistGridLayout: async () => {
    const { gridLayout } = get()
    await window.cccAPI.config.update({ gridLayout: gridLayout ?? undefined })
  },

  resetGridLayout: () => {
    const { sessions, excludedSessions, gridPresets } = get()
    const visibleIds = sessions.filter((s) => !excludedSessions.includes(s.name)).map((s) => s.id)
    const newLayout = visibleIds.length > 0 ? buildAutoGrid(visibleIds, gridPresets) : null
    set({ gridLayout: newLayout })
    void window.cccAPI.config.update({ gridLayout: null })
  },

  setActiveView: (view) => set({ activeView: view }),

  openInIde: async (sessionId: string) => {
    await window.cccAPI.session.openInIde(sessionId)
  },

  openFolder: async (sessionId: string) => {
    await window.cccAPI.session.openFolder(sessionId)
  },

  getGroupedSessions: () => {
    const { sessions, sessionGroups } = get()
    const manuallyGrouped = new Set<string>()
    const groups: Array<{ group: SessionGroup | { id: string; name: string; auto: true }; sessionIds: string[] }> = []

    // Manual groups first
    for (const group of sessionGroups) {
      const validIds = group.sessionIds.filter(id => sessions.find(s => s.id === id))
      if (validIds.length > 0) {
        groups.push({ group, sessionIds: validIds })
        for (const id of validIds) manuallyGrouped.add(id)
      }
    }

    // Auto-groups from repoPath
    const repoMap = new Map<string, string[]>()
    for (const session of sessions) {
      if (manuallyGrouped.has(session.id) || !session.repoPath) continue
      const existing = repoMap.get(session.repoPath) ?? []
      existing.push(session.id)
      repoMap.set(session.repoPath, existing)
    }
    for (const [repoPath, sessionIds] of repoMap) {
      if (sessionIds.length >= 2) {
        const repoName = repoPath.split('/').pop() ?? repoPath
        groups.push({
          group: { id: `auto-${repoPath}`, name: repoName, auto: true },
          sessionIds
        })
        for (const id of sessionIds) manuallyGrouped.add(id)
      }
    }

    const ungrouped = sessions.filter(s => !manuallyGrouped.has(s.id)).map(s => s.id)
    return { groups, ungrouped }
  },
}))
