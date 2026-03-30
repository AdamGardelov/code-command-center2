export type SessionStatus = 'idle' | 'working' | 'waiting' | 'stopped' | 'error'

export type SessionType = 'claude' | 'shell'

export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: SessionStatus
  type: SessionType
  color: string
  gitBranch?: string
  createdAt: number
  lastActiveAt: number
}

export interface SessionCreate {
  name: string
  workingDirectory: string
  type: SessionType
}

export type ViewMode = 'single' | 'grid'

export type Theme = 'dark' | 'light'

export interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
}

export interface CccConfig {
  theme: Theme
  sidebarWidth: number
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
  sessionTypes: Record<string, SessionType>
}

export interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  session: {
    list: () => Promise<Session[]>
    create: (opts: SessionCreate) => Promise<Session>
    kill: (id: string) => Promise<void>
    attach: (id: string) => void
    detach: (id: string) => void
  }
  terminal: {
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, cols: number, rows: number) => void
    onData: (callback: (sessionId: string, data: string) => void) => () => void
  }
  state: {
    onStateChanged: (callback: (sessionId: string, status: SessionStatus) => void) => () => void
  }
  config: {
    load: () => Promise<CccConfig>
    update: (partial: Partial<CccConfig>) => Promise<CccConfig>
  }
}
