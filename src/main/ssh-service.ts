import { execFileSync } from 'child_process'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { BrowserWindow } from 'electron'

const CCC_DIR = join(process.env.HOME ?? '', '.ccc')

function sshOptions(host: string): string[] {
  return [
    '-o', 'ControlMaster=auto',
    '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
    '-o', 'ControlPersist=300',
    '-o', 'ConnectTimeout=5',
    '-o', 'BatchMode=yes',
    host
  ]
}

export class SshService {
  private hostStatuses: Map<string, boolean> = new Map()
  private window: BrowserWindow | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  exec(host: string, command: string): string | null {
    try {
      if (!existsSync(CCC_DIR)) mkdirSync(CCC_DIR, { recursive: true })
      return execFileSync('ssh', [...sshOptions(host), command], {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
    } catch {
      return null
    }
  }

  isOnline(host: string): boolean {
    try {
      execFileSync('ssh', [
        '-o', 'ConnectTimeout=3',
        '-o', 'BatchMode=yes',
        '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
        '-o', 'ControlMaster=auto',
        host, 'true'
      ], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      return true
    } catch {
      return false
    }
  }

  getStatuses(): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const [name, online] of this.hostStatuses) {
      result[name] = online
    }
    return result
  }

  startMonitoring(hosts: Array<{ name: string; host: string }>): void {
    // Initial check
    for (const h of hosts) {
      const online = this.isOnline(h.host)
      this.hostStatuses.set(h.name, online)
    }
    this.emitAll()

    // Periodic: re-check every 10s
    this.checkInterval = setInterval(() => {
      let changed = false
      for (const h of hosts) {
        const wasOnline = this.hostStatuses.get(h.name) ?? false
        const nowOnline = this.isOnline(h.host)
        if (wasOnline !== nowOnline) {
          this.hostStatuses.set(h.name, nowOnline)
          changed = true
        }
      }
      if (changed) this.emitAll()
    }, 10000)
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private emitAll(): void {
    if (this.window && !this.window.isDestroyed()) {
      for (const [name, online] of this.hostStatuses) {
        this.window.webContents.send('host:status-changed', name, online)
      }
    }
  }
}
