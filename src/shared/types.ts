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
  isArchived?: boolean
  displayName?: string
  isContainer?: boolean
  containerName?: string
}

export interface SessionCreate {
  name: string
  workingDirectory: string
  type: SessionType
  remoteHost?: string
  skipPermissions?: boolean
  containerName?: string
}

export type ViewMode = 'single' | 'grid'

export type SplitDirection = 'horizontal' | 'vertical'

export type SplitNode =
  | { type: 'leaf'; sessionId: string }
  | {
      type: 'split'
      direction: SplitDirection
      ratio: number
      children: [SplitNode, SplitNode]
    }

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

export interface ContainerConfig {
  name: string
  label?: string
  remoteHost?: string
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

export interface PrReviewer {
  login: string
  state: 'pending' | 'approved' | 'changes_requested'
}

export interface PullRequest {
  id: string
  number: number
  title: string
  url: string
  repo: string
  author: string
  isDraft: boolean
  additions: number
  deletions: number
  reviewDecision: 'approved' | 'changes_requested' | 'review_required' | 'none'
  reviewers: PrReviewer[]
  checksStatus: 'passing' | 'failing' | 'pending' | 'none'
  commentCount: number
  unresolvedThreads: number
  createdAt: string
  updatedAt: string
}

export interface PrNotificationConfig {
  approved: boolean
  changesRequested: boolean
  newComment: boolean
  newReviewer: boolean
  newPr: boolean
}

export interface PrConfig {
  githubOrg: string
  pinnedRepos: string[]
  teamMembers: string[]
  pollInterval: number
  showMyDrafts: boolean
  showOthersDrafts: boolean
  notifications: PrNotificationConfig
  dismissedAttention: string[]
}

export interface FeaturesConfig {
  pullRequests: boolean
  containers: boolean
}

export type PrTab = 'mine' | 'team' | 'reviews'

export type ActiveView = 'sessions' | 'pullRequests'

export interface PrState {
  myPrs: PullRequest[]
  teamPrs: PullRequest[]
  reviewPrs: PullRequest[]
  attentionItems: Array<{ pr: PullRequest; reason: 'ready_to_merge' | 'changes_requested' }>
  currentUser: string
  lastUpdated: string | null
  isLoading: boolean
  error: string | null
}

export interface CccConfig {
  theme: Theme
  sidebarWidth: number
  worktreeBasePath: string
  worktreeSyncPaths: string[]
  favoriteFolders: FavoriteFolder[]
  sessionColors: Record<string, string>
  sessionTypes: Record<string, SessionType>
  enabledProviders: AiProvider[]
  remoteHosts: RemoteHost[]
  sessionGroups: SessionGroup[]
  zoomFactor: number
  dangerouslySkipPermissions: boolean
  excludedSessions: string[]
  archivedSessions: string[]
  sessionDisplayNames: Record<string, string>
  notificationsEnabled: boolean
  mutedSessions: string[]
  ideCommand?: string
  claudeConfigRoutes: ClaudeConfigRoute[]
  defaultClaudeConfigDir?: string
  features: FeaturesConfig
  prConfig?: PrConfig
  containers: ContainerConfig[]
  containerSessions: Record<string, string>
  gridLayout?: SplitNode | null
  gridPresets?: Record<string, string>
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
    openFolder: (id: string) => Promise<void>
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
    toggleMuted: (sessionName: string) => Promise<void>
    toggleArchived: (sessionName: string) => Promise<void>
    setDisplayName: (sessionName: string, displayName: string) => Promise<void>
  }
  notification: {
    onToast: (callback: (data: { sessionName: string; message: string; color: string }) => void) => () => void
    onNavigate: (callback: (sessionName: string) => void) => () => void
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
  pr: {
    getState: () => Promise<Partial<PrState>>
    onState: (callback: (state: PrState) => void) => () => void
    refresh: () => void
    onNavigate: (callback: () => void) => () => void
  }
  clipboard: {
    writeText: (text: string) => void
  }
  shell: {
    openExternal: (url: string) => void
  }
  container: {
    listRunning: (remoteHost?: string) => Promise<ContainerConfig[]>
  }
  app: {
    platform: () => Promise<string>
    logs: (lines?: number) => Promise<string>
    logPath: () => Promise<string>
  }
}
