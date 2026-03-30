import { create } from 'zustand'
import type { Session, SessionCreate, ViewMode, GridItem, Theme } from '../../shared/types'

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  viewMode: ViewMode
  sidebarOpen: boolean
  sidebarWidth: number
  gridLayout: GridItem[]
  modalOpen: boolean
  theme: Theme

  createSession: (opts: SessionCreate) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  toggleModal: () => void
  toggleTheme: () => void
  updateGridLayout: (layout: GridItem[]) => void
  nextSession: () => void
  prevSession: () => void
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateGridLayout(sessions: Session[]): GridItem[] {
  const cols = sessions.length <= 2 ? sessions.length : sessions.length <= 4 ? 2 : 3
  return sessions.map((s, i) => ({
    i: s.id,
    x: i % cols,
    y: Math.floor(i / cols),
    w: 1,
    h: 1
  }))
}

const now = Date.now()

const mockSessions: Session[] = [
  {
    id: generateId(),
    name: 'api-server',
    workingDirectory: '~/projects/api-server',
    status: 'running',
    createdAt: now - 3600000,
    lastActiveAt: now - 120000
  },
  {
    id: generateId(),
    name: 'frontend',
    workingDirectory: '~/projects/frontend',
    status: 'running',
    createdAt: now - 7200000,
    lastActiveAt: now - 900000
  },
  {
    id: generateId(),
    name: 'infra-setup',
    workingDirectory: '~/projects/infra',
    status: 'stopped',
    createdAt: now - 86400000,
    lastActiveAt: now - 3600000
  },
  {
    id: generateId(),
    name: 'docs-rewrite',
    workingDirectory: '~/projects/docs',
    status: 'error',
    createdAt: now - 10800000,
    lastActiveAt: now - 10800000
  }
]

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: mockSessions[0].id,
  viewMode: 'single',
  sidebarOpen: true,
  sidebarWidth: 260,
  gridLayout: generateGridLayout(mockSessions),
  modalOpen: false,
  theme: 'dark',

  createSession: (opts) => {
    const session: Session = {
      id: generateId(),
      name: opts.name,
      workingDirectory: opts.workingDirectory,
      status: 'running',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }
    set((state) => {
      const sessions = [...state.sessions, session]
      return {
        sessions,
        activeSessionId: session.id,
        gridLayout: generateGridLayout(sessions)
      }
    })
  },

  removeSession: (id) => {
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
