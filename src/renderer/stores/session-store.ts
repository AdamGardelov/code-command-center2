import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, GridItem, Theme, SessionStatus } from '../../shared/types'

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  viewMode: ViewMode
  sidebarOpen: boolean
  sidebarWidth: number
  gridLayout: GridItem[]
  modalOpen: boolean
  theme: Theme
  loading: boolean

  loadSessions: () => Promise<void>
  createSession: (opts: SessionCreate) => Promise<void>
  removeSession: (id: string) => Promise<void>
  setActiveSession: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleModal: () => void
  toggleTheme: () => void
  updateGridLayout: (layout: GridItem[]) => void
  updateSessionStatus: (sessionName: string, status: SessionStatus) => void
  nextSession: () => void
  prevSession: () => void
}

function generateGridLayout(sessions: Session[]): GridItem[] {
  const cols = sessions.length <= 2 ? (sessions.length || 1) : sessions.length <= 4 ? 2 : 3
  return sessions.map((s, i) => ({
    i: s.id,
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1
  }))
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  viewMode: 'single',
  sidebarOpen: true,
  sidebarWidth: 260,
  gridLayout: [],
  modalOpen: false,
  theme: 'dark',
  loading: true,

  loadSessions: async () => {
    const sessions = await window.cccAPI.session.list()
    set((state) => ({
      sessions,
      loading: false,
      activeSessionId: state.activeSessionId && sessions.find(s => s.id === state.activeSessionId)
        ? state.activeSessionId
        : sessions[0]?.id ?? null,
      gridLayout: generateGridLayout(sessions)
    }))
  },

  createSession: async (opts) => {
    const session = await window.cccAPI.session.create(opts)
    set((state) => {
      const sessions = [...state.sessions, session]
      return {
        sessions,
        activeSessionId: session.id,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  removeSession: async (id) => {
    await window.cccAPI.session.kill(id)
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      const activeSessionId =
        state.activeSessionId === id
          ? sessions[0]?.id ?? null
          : state.activeSessionId
      return {
        sessions,
        activeSessionId,
        gridLayout: generateGridLayout(sessions)
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
    return { theme: next }
  }),
  updateGridLayout: (layout) => set({ gridLayout: layout }),

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
