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
  sessionGroups: [],
  zoomFactor: 1.0,
  dangerouslySkipPermissions: false,
  excludedSessions: [],
  notificationsEnabled: true,
  mutedSessions: [],
  claudeConfigRoutes: []
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
          sessionGroups: Array.isArray(parsed.sessionGroups) ? parsed.sessionGroups : [],
          zoomFactor: typeof parsed.zoomFactor === 'number' ? parsed.zoomFactor : 1.0,
          dangerouslySkipPermissions: parsed.dangerouslySkipPermissions === true,
          excludedSessions: Array.isArray(parsed.excludedSessions) ? parsed.excludedSessions : [],
          notificationsEnabled: parsed.notificationsEnabled !== false,
          mutedSessions: Array.isArray(parsed.mutedSessions) ? parsed.mutedSessions : [],
          ideCommand: typeof parsed.ideCommand === 'string' ? parsed.ideCommand : undefined,
          claudeConfigRoutes: Array.isArray(parsed.claudeConfigRoutes) ? parsed.claudeConfigRoutes : [],
          defaultClaudeConfigDir: typeof parsed.defaultClaudeConfigDir === 'string' ? parsed.defaultClaudeConfigDir : undefined
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
    if (partial.sessionGroups !== undefined) this.config.sessionGroups = partial.sessionGroups
    if (partial.zoomFactor !== undefined) this.config.zoomFactor = partial.zoomFactor
    if (partial.dangerouslySkipPermissions !== undefined) this.config.dangerouslySkipPermissions = partial.dangerouslySkipPermissions
    if (partial.excludedSessions !== undefined) this.config.excludedSessions = partial.excludedSessions
    if (partial.notificationsEnabled !== undefined) this.config.notificationsEnabled = partial.notificationsEnabled
    if (partial.mutedSessions !== undefined) this.config.mutedSessions = partial.mutedSessions
    if (partial.ideCommand !== undefined) this.config.ideCommand = partial.ideCommand
    if (partial.claudeConfigRoutes !== undefined) this.config.claudeConfigRoutes = partial.claudeConfigRoutes
    if (partial.defaultClaudeConfigDir !== undefined) this.config.defaultClaudeConfigDir = partial.defaultClaudeConfigDir

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

  get(): CccConfig {
    return this.config
  }
}
