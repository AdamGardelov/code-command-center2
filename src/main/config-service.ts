import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { CccConfig } from '../shared/types'

const CONFIG_DIR = join(process.env.HOME ?? '', '.ccc')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: CccConfig = {
  theme: 'dark',
  sidebarWidth: 260,
  favoriteFolders: [],
  sessionColors: {}
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
            : {}
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
    if (partial.theme !== undefined) this.config.theme = partial.theme
    if (partial.sidebarWidth !== undefined) this.config.sidebarWidth = partial.sidebarWidth
    if (partial.favoriteFolders !== undefined) this.config.favoriteFolders = partial.favoriteFolders

    this.save(this.config)
    return this.config
  }

  get(): CccConfig {
    return this.config
  }
}
