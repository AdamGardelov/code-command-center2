export type SessionStatus = 'idle' | 'working' | 'waiting' | 'stopped' | 'error'

export type SessionType = 'claude' | 'gemini' | 'shell'

export type AiProvider = 'claude' | 'gemini'

export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: SessionStatus
  type: SessionType
  color: string
  remoteHost?: string
  gitBranch?: string
  repoPath?: string
  createdAt: number
  lastActiveAt: number
  skipPermissions?: boolean
  isExcluded?: boolean
}

export interface SessionCreate {
  name: string
  workingDirectory: string
  type: SessionType
  remoteHost?: string
}

export type ViewMode = 'single' | 'grid'

export type Theme = 'dark' | 'light'

export interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
  worktreePath?: string
}

export interface RemoteHost {
  name: string
  host: string
  shell?: string
  worktreeBasePath?: string
  favoriteFolders: FavoriteFolder[]
}

export interface SessionGroup {
  id: string
  name: string
  sessionIds: string[]
}

export interface ClaudeConfigRoute {
  pathPrefix: string
  configDir: string
}

export interface Worktree {
  path: string
  branch: string
  isMain: boolean
  repoPath: string
}

export interface CccConfig {
  theme: Theme
  sidebarWidth: number
  worktreeBasePath: string
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
  sessionTypes: Record<string, SessionType>
  enabledProviders: AiProvider[]
  remoteHosts: RemoteHost[]
  sessionGroups: SessionGroup[]
  zoomFactor: number
  dangerouslySkipPermissions: boolean
  excludedSessions: string[]
  ideCommand?: string
  claudeConfigRoutes: ClaudeConfigRoute[]
  defaultClaudeConfigDir?: string
}

export interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    setZoomFactor: (factor: number) => void
  }
  session: {
    list: () => Promise<Session[]>
    create: (opts: SessionCreate) => Promise<Session>
    kill: (id: string) => Promise<void>
    attach: (id: string, cols?: number, rows?: number) => void
    detach: (id: string) => void
    openInIde: (id: string) => Promise<void>
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
    toggleExcluded: (sessionName: string) => Promise<void>
  }
  host: {
    statuses: () => Promise<Record<string, boolean>>
    onStatusChanged: (callback: (name: string, online: boolean) => void) => () => void
  }
  git: {
    listWorktrees: (repoPath: string, remoteHost?: string) => Promise<Worktree[]>
    addWorktree: (repoPath: string, branch: string, targetPath: string, remoteHost?: string) => Promise<Worktree>
    removeWorktree: (worktreePath: string, remoteHost?: string) => Promise<void>
    listBranches: (repoPath: string, remoteHost?: string) => Promise<string[]>
  }
  group: {
    create: (name: string) => Promise<SessionGroup>
    delete: (groupId: string) => Promise<void>
    addSession: (groupId: string, sessionId: string) => Promise<void>
    removeSession: (groupId: string, sessionId: string) => Promise<void>
  }
}
