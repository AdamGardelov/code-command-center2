import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { CccConfig } from '../shared/types'

const CONFIG_DIR = join(process.env.HOME ?? '', '.ccc')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: CccConfig = {
  theme: 'dark',
  sidebarWidth: 260,
  favoriteFolders: [],
  sessionColors: {},
  sessionTypes: {},
  enabledProviders: ['claude'],
  remoteHosts: [],
  worktreeBasePath: '~/worktrees',
  worktreeSyncPaths: ['.claude', 'CLAUDE.md'],
  sessionGroups: [],
  zoomFactor: 1.0,
  dangerouslySkipPermissions: false,
  enableAutoMode: false,
  codexFullAuto: false,
  codexDangerouslyBypassApprovals: false,
  excludedSessions: [],
  archivedSessions: [],
  sessionDisplayNames: {},
  notificationsEnabled: true,
  mutedSessions: [],
  claudeConfigRoutes: [],
  features: { pullRequests: false, containers: false },
  containers: [],
  containerSessions: {},
  gridLayout: null,
  gridPresets: {},
}

export class ConfigService {
  private config: CccConfig = { ...DEFAULT_CONFIG }

  load(): CccConfig {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }
      if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, 'utf-8')
        const parsed = JSON.parse(raw)
        this.config = {
          theme: parsed.theme ?? DEFAULT_CONFIG.theme,
          sidebarWidth: parsed.sidebarWidth ?? DEFAULT_CONFIG.sidebarWidth,
          favoriteFolders: Array.isArray(parsed.favoriteFolders) ? parsed.favoriteFolders : [],
          sessionColors: parsed.sessionColors && typeof parsed.sessionColors === 'object'
            ? parsed.sessionColors
            : {},
          sessionTypes: parsed.sessionTypes && typeof parsed.sessionTypes === 'object'
            ? parsed.sessionTypes
            : {},
          enabledProviders: Array.isArray(parsed.enabledProviders) ? parsed.enabledProviders : ['claude'],
          remoteHosts: Array.isArray(parsed.remoteHosts) ? parsed.remoteHosts : [],
          worktreeBasePath: typeof parsed.worktreeBasePath === 'string' ? parsed.worktreeBasePath : '~/worktrees',
          worktreeSyncPaths: Array.isArray(parsed.worktreeSyncPaths) ? parsed.worktreeSyncPaths : ['.claude', 'CLAUDE.md'],
          sessionGroups: Array.isArray(parsed.sessionGroups) ? parsed.sessionGroups : [],
          zoomFactor: typeof parsed.zoomFactor === 'number' ? parsed.zoomFactor : 1.0,
          dangerouslySkipPermissions: parsed.dangerouslySkipPermissions === true,
          enableAutoMode: parsed.enableAutoMode === true,
          codexFullAuto: parsed.codexFullAuto === true,
          codexDangerouslyBypassApprovals: parsed.codexDangerouslyBypassApprovals === true,
          excludedSessions: Array.isArray(parsed.excludedSessions) ? parsed.excludedSessions : [],
          archivedSessions: Array.isArray(parsed.archivedSessions) ? parsed.archivedSessions : [],
          sessionDisplayNames: parsed.sessionDisplayNames && typeof parsed.sessionDisplayNames === 'object'
            ? parsed.sessionDisplayNames
            : {},
          notificationsEnabled: parsed.notificationsEnabled !== false,
          mutedSessions: Array.isArray(parsed.mutedSessions) ? parsed.mutedSessions : [],
          ideCommand: typeof parsed.ideCommand === 'string' ? parsed.ideCommand : undefined,
          screenshotPasteHostDir: typeof parsed.screenshotPasteHostDir === 'string' ? parsed.screenshotPasteHostDir : undefined,
          screenshotPasteSessionDir: typeof parsed.screenshotPasteSessionDir === 'string' ? parsed.screenshotPasteSessionDir : undefined,
          claudeConfigRoutes: Array.isArray(parsed.claudeConfigRoutes) ? parsed.claudeConfigRoutes : [],
          defaultClaudeConfigDir: typeof parsed.defaultClaudeConfigDir === 'string' ? parsed.defaultClaudeConfigDir : undefined,
          features: parsed.features && typeof parsed.features === 'object'
            ? { pullRequests: parsed.features.pullRequests === true, containers: parsed.features.containers === true }
            : { pullRequests: false, containers: false },
          containers: Array.isArray(parsed.containers) ? parsed.containers : [],
          containerSessions: parsed.containerSessions && typeof parsed.containerSessions === 'object' ? parsed.containerSessions : {},
          gridLayout: parsed.gridLayout ?? null,
          gridPresets: parsed.gridPresets && typeof parsed.gridPresets === 'object' ? parsed.gridPresets : {},
          prConfig: parsed.prConfig && typeof parsed.prConfig === 'object'
            ? {
                githubOrg: typeof parsed.prConfig.githubOrg === 'string' ? parsed.prConfig.githubOrg : '',
                pinnedRepos: Array.isArray(parsed.prConfig.pinnedRepos) ? parsed.prConfig.pinnedRepos : [],
                teamMembers: Array.isArray(parsed.prConfig.teamMembers) ? parsed.prConfig.teamMembers : [],
                pollInterval: typeof parsed.prConfig.pollInterval === 'number' ? parsed.prConfig.pollInterval : 120,
                showMyDrafts: parsed.prConfig.showMyDrafts !== false,
                showOthersDrafts: parsed.prConfig.showOthersDrafts === true,
                notifications: parsed.prConfig.notifications && typeof parsed.prConfig.notifications === 'object'
                  ? {
                      approved: parsed.prConfig.notifications.approved !== false,
                      changesRequested: parsed.prConfig.notifications.changesRequested !== false,
                      newComment: parsed.prConfig.notifications.newComment !== false,
                      newReviewer: parsed.prConfig.notifications.newReviewer !== false,
                      newPr: parsed.prConfig.notifications.newPr !== false,
                    }
                  : { approved: true, changesRequested: true, newComment: true, newReviewer: true, newPr: true },
                dismissedAttention: Array.isArray(parsed.prConfig.dismissedAttention) ? parsed.prConfig.dismissedAttention : [],
              }
            : undefined,
        }
      } else {
        this.config = { ...DEFAULT_CONFIG }
        this.save(this.config)
      }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
    return this.config
  }

  save(config: CccConfig): void {
    try {
      if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true })
      }
      writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
      this.config = config
    } catch (err) {
      console.error('Failed to save config:', err)
    }
  }

  update(partial: Partial<CccConfig>): CccConfig {
    if (partial.sessionColors) {
      this.config.sessionColors = { ...this.config.sessionColors, ...partial.sessionColors }
    }
    if (partial.sessionTypes) {
      this.config.sessionTypes = { ...this.config.sessionTypes, ...partial.sessionTypes }
    }
    if (partial.enabledProviders !== undefined) this.config.enabledProviders = partial.enabledProviders
    if (partial.theme !== undefined) this.config.theme = partial.theme
    if (partial.sidebarWidth !== undefined) this.config.sidebarWidth = partial.sidebarWidth
    if (partial.favoriteFolders !== undefined) this.config.favoriteFolders = partial.favoriteFolders
    if (partial.remoteHosts !== undefined) this.config.remoteHosts = partial.remoteHosts
    if (partial.worktreeBasePath !== undefined) this.config.worktreeBasePath = partial.worktreeBasePath
    if (partial.worktreeSyncPaths !== undefined) this.config.worktreeSyncPaths = partial.worktreeSyncPaths
    if (partial.sessionGroups !== undefined) this.config.sessionGroups = partial.sessionGroups
    if (partial.zoomFactor !== undefined) this.config.zoomFactor = partial.zoomFactor
    if (partial.dangerouslySkipPermissions !== undefined) this.config.dangerouslySkipPermissions = partial.dangerouslySkipPermissions
    if (partial.enableAutoMode !== undefined) this.config.enableAutoMode = partial.enableAutoMode
    if (partial.excludedSessions !== undefined) this.config.excludedSessions = partial.excludedSessions
    if (partial.archivedSessions !== undefined) this.config.archivedSessions = partial.archivedSessions
    if (partial.sessionDisplayNames !== undefined) this.config.sessionDisplayNames = { ...this.config.sessionDisplayNames, ...partial.sessionDisplayNames }
    if (partial.notificationsEnabled !== undefined) this.config.notificationsEnabled = partial.notificationsEnabled
    if (partial.mutedSessions !== undefined) this.config.mutedSessions = partial.mutedSessions
    if (partial.ideCommand !== undefined) this.config.ideCommand = partial.ideCommand
    if (partial.screenshotPasteHostDir !== undefined) {
      this.config.screenshotPasteHostDir = partial.screenshotPasteHostDir || undefined
    }
    if (partial.screenshotPasteSessionDir !== undefined) {
      this.config.screenshotPasteSessionDir = partial.screenshotPasteSessionDir || undefined
    }
    if (partial.claudeConfigRoutes !== undefined) this.config.claudeConfigRoutes = partial.claudeConfigRoutes
    if (partial.defaultClaudeConfigDir !== undefined) this.config.defaultClaudeConfigDir = partial.defaultClaudeConfigDir
    if (partial.features !== undefined) this.config.features = partial.features
    if (partial.prConfig !== undefined) this.config.prConfig = partial.prConfig
    if (partial.containers !== undefined) this.config.containers = partial.containers
    if (partial.containerSessions !== undefined) this.config.containerSessions = partial.containerSessions
    if (partial.gridLayout !== undefined) this.config.gridLayout = partial.gridLayout
    if (partial.gridPresets !== undefined) this.config.gridPresets = partial.gridPresets

    this.save(this.config)
    return this.config
  }

  resolveClaudeConfigDir(workingDirectory: string): string | undefined {
    const expanded = workingDirectory.replace(/^~/, process.env.HOME ?? '')
    for (const route of this.config.claudeConfigRoutes) {
      const prefix = route.pathPrefix.replace(/^~/, process.env.HOME ?? '')
      if (expanded.startsWith(prefix)) {
        return route.configDir.replace(/^~/, process.env.HOME ?? '')
      }
    }
    if (this.config.defaultClaudeConfigDir) {
      return this.config.defaultClaudeConfigDir.replace(/^~/, process.env.HOME ?? '')
    }
    return undefined
  }

  toggleMuted(sessionName: string): void {
    const idx = this.config.mutedSessions.indexOf(sessionName)
    if (idx >= 0) {
      this.config.mutedSessions.splice(idx, 1)
    } else {
      this.config.mutedSessions.push(sessionName)
    }
    this.save(this.config)
  }

  toggleExcluded(sessionName: string): void {
    const idx = this.config.excludedSessions.indexOf(sessionName)
    if (idx >= 0) {
      this.config.excludedSessions.splice(idx, 1)
    } else {
      this.config.excludedSessions.push(sessionName)
    }
    this.save(this.config)
  }

  toggleArchived(sessionName: string): void {
    const idx = this.config.archivedSessions.indexOf(sessionName)
    if (idx >= 0) {
      this.config.archivedSessions.splice(idx, 1)
    } else {
      this.config.archivedSessions.push(sessionName)
      const exIdx = this.config.excludedSessions.indexOf(sessionName)
      if (exIdx >= 0) {
        this.config.excludedSessions.splice(exIdx, 1)
      }
    }
    this.save(this.config)
  }

  setDisplayName(sessionName: string, displayName: string): void {
    if (displayName.trim() === '') {
      delete this.config.sessionDisplayNames[sessionName]
    } else {
      this.config.sessionDisplayNames[sessionName] = displayName.trim()
    }
    this.save(this.config)
  }

  pruneSessionName(sessionName: string): void {
    let changed = false
    if (this.config.sessionDisplayNames[sessionName] !== undefined) {
      delete this.config.sessionDisplayNames[sessionName]
      changed = true
    }
    if (this.config.containerSessions[sessionName] !== undefined) {
      delete this.config.containerSessions[sessionName]
      changed = true
    }
    const archivedIdx = this.config.archivedSessions.indexOf(sessionName)
    if (archivedIdx >= 0) {
      this.config.archivedSessions.splice(archivedIdx, 1)
      changed = true
    }
    const excludedIdx = this.config.excludedSessions.indexOf(sessionName)
    if (excludedIdx >= 0) {
      this.config.excludedSessions.splice(excludedIdx, 1)
      changed = true
    }
    const mutedIdx = this.config.mutedSessions.indexOf(sessionName)
    if (mutedIdx >= 0) {
      this.config.mutedSessions.splice(mutedIdx, 1)
      changed = true
    }
    if (changed) this.save(this.config)
  }

  get(): CccConfig {
    return this.config
  }
}
