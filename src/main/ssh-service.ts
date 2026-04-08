import { execFileSync, execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { BrowserWindow } from 'electron'

const execFileAsync = promisify(execFile)
const CCC_DIR = join(process.env.HOME ?? '', '.ccc')

function sshOptions(host: string): string[] {
  return [
    '-o', 'ControlMaster=auto',
    '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
    '-o', 'ControlPersist=300',
    '-o', 'ConnectTimeout=3',
    '-o', 'BatchMode=yes',
    host
  ]
}

interface HostStatus {
  host: string
  online: boolean
}

export class SshService {
  // Keyed by host *name*; value carries the resolved sshHost so exec() can short-circuit by host string.
  private hostStatuses: Map<string, HostStatus> = new Map()
  private window: BrowserWindow | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  /** True if we've checked this sshHost and it's currently offline. Unknown hosts are treated as online. */
  private isKnownOffline(sshHost: string): boolean {
    for (const s of this.hostStatuses.values()) {
      if (s.host === sshHost) return !s.online
    }
    return false
  }

  exec(host: string, command: string): string | null {
    // Short-circuit when host is known offline. Synchronous SSH calls block the Electron main
    // thread for up to the connect timeout, so calling them against a dead host (e.g. VPN down)
    // freezes the UI. The monitor below keeps statuses fresh.
    if (this.isKnownOffline(host)) return null
    try {
      if (!existsSync(CCC_DIR)) mkdirSync(CCC_DIR, { recursive: true })
      return execFileSync('ssh', [...sshOptions(host), command], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
    } catch {
      // Proactively mark this host offline so subsequent exec() calls short-circuit instead of
      // each eating another connect timeout. The next monitor tick will flip it back if/when
      // the host recovers.
      this.markOfflineByHost(host)
      return null
    }
  }

  private markOfflineByHost(sshHost: string): void {
    let changed = false
    for (const [name, s] of this.hostStatuses) {
      if (s.host === sshHost && s.online) {
        this.hostStatuses.set(name, { host: s.host, online: false })
        changed = true
      }
    }
    if (changed) this.emitAll()
  }

  /** Async reachability check — never blocks the event loop. */
  private async checkOnline(host: string): Promise<boolean> {
    try {
      await execFileAsync('ssh', [
        '-o', 'ConnectTimeout=3',
        '-o', 'BatchMode=yes',
        '-o', `ControlPath=${CCC_DIR}/ssh-%r@%h:%p`,
        '-o', 'ControlMaster=auto',
        host, 'true'
      ], { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  getStatuses(): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const [name, s] of this.hostStatuses) {
      result[name] = s.online
    }
    return result
  }

  startMonitoring(hosts: Array<{ name: string; host: string }>): void {
    // Seed entries optimistically as online so exec() works during the very first check window
    // (matches prior behavior where the initial sync probe ran before exec calls were possible).
    for (const h of hosts) {
      if (!this.hostStatuses.has(h.name)) {
        this.hostStatuses.set(h.name, { host: h.host, online: true })
      }
    }

    const runChecks = async (): Promise<void> => {
      let changed = false
      await Promise.all(hosts.map(async (h) => {
        const prev = this.hostStatuses.get(h.name)?.online ?? true
        const online = await this.checkOnline(h.host)
        if (online !== prev) changed = true
        this.hostStatuses.set(h.name, { host: h.host, online })
      }))
      if (changed) this.emitAll()
    }

    // Kick off the initial check immediately (non-blocking) and emit when it completes.
    void runChecks().then(() => this.emitAll())

    // Periodic re-check every 10s. Async, so it never blocks the main thread.
    this.checkInterval = setInterval(() => {
      void runChecks()
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
      for (const [name, s] of this.hostStatuses) {
        this.window.webContents.send('host:status-changed', name, s.online)
      }
    }
  }
}
