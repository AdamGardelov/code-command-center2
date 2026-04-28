import { execFileSync } from 'child_process'
import type { ContainerConfig } from '../shared/types'
import type { SshService } from './ssh-service'
import type { ConfigService } from './config-service'

function isValidContainerName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)
}

interface CacheEntry {
  running: boolean
  expiresAt: number
}

const TTL_MS = 30_000

export class ContainerService {
  private sshService: SshService | null = null
  private configService: ConfigService | null = null
  private cache = new Map<string, CacheEntry>()

  setSshService(sshService: SshService): void {
    this.sshService = sshService
  }

  setConfigService(configService: ConfigService): void {
    this.configService = configService
  }

  isRunning(containerName: string, remoteHost?: string, skipCache?: boolean): boolean {
    if (!isValidContainerName(containerName)) return false
    const cacheKey = `${remoteHost ?? 'local'}:${containerName}`
    if (!skipCache) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() < cached.expiresAt) {
        return cached.running
      }
    }

    let running = false
    try {
      if (remoteHost && this.sshService) {
        const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
        const sshHost = hostConfig?.host ?? remoteHost
        const result = this.sshService.exec(sshHost, `docker inspect --format={{.State.Running}} ${containerName}`)
        running = result?.trim() === 'true'
      } else {
        const result = execFileSync('docker', ['inspect', '--format={{.State.Running}}', containerName], {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
        running = result.trim() === 'true'
      }
    } catch {
      running = false
    }

    this.cache.set(cacheKey, { running, expiresAt: Date.now() + TTL_MS })
    return running
  }

  listRepos(containerName: string, remoteHost?: string): string[] {
    if (!isValidContainerName(containerName)) return []
    try {
      if (remoteHost && this.sshService) {
        const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
        const sshHost = hostConfig?.host ?? remoteHost
        const result = this.sshService.exec(sshHost, `docker exec ${containerName} ls -1 /repos`)
        if (!result) return []
        return result.split('\n').map(s => s.trim()).filter(s => s.length > 0)
      }
      const result = execFileSync('docker', ['exec', containerName, 'ls', '-1', '/repos'], {
        timeout: 5000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      return result.split('\n').map(s => s.trim()).filter(s => s.length > 0)
    } catch {
      return []
    }
  }

  listRunning(remoteHost?: string): ContainerConfig[] {
    const containers = this.configService?.get().containers ?? []
    return containers
      .filter(c => (c.remoteHost ?? undefined) === (remoteHost ?? undefined))
      .filter(c => this.isRunning(c.name, c.remoteHost))
  }

  clearCache(): void {
    this.cache.clear()
  }
}
