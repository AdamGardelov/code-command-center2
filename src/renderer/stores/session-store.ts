import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder, AiProvider } from '../../shared/types'

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

  loadConfig: () => Promise<void>
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
  setEnabledProviders: (providers: AiProvider[]) => Promise<void>
  persistSidebarWidth: () => Promise<void>
  updateSessionStatus: (sessionName: string, status: SessionStatus) => void
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

  loadConfig: async () => {
    const config = await window.cccAPI.config.load()
    document.documentElement.setAttribute('data-theme', config.theme)
    set({
      theme: config.theme,
      sidebarWidth: config.sidebarWidth,
      favorites: config.favoriteFolders,
      enabledProviders: config.enabledProviders ?? ['claude']
    })
  },

  loadSessions: async () => {
    const sessions = await window.cccAPI.session.list()
    set((state) => ({
      sessions,
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
      return {
        sessions,
        activeSessionId:
          state.activeSessionId === id
            ? sessions[0]?.id ?? null
            : state.activeSessionId
      }
    })
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
  setEnabledProviders: async (providers) => {
    await window.cccAPI.config.update({ enabledProviders: providers })
    set({ enabledProviders: providers })
  },
  persistSidebarWidth: async () => {
    const { sidebarWidth } = get()
    await window.cccAPI.config.update({ sidebarWidth })
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
  }
}))
