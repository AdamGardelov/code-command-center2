import { app, BrowserWindow } from 'electron'
import semver from 'semver'
import { spawn } from 'child_process'
import type { UpdaterState, UpdaterInstallResult } from '../shared/types'
import { log } from './log-service'

const REPO = 'AdamGardelov/code-command-center2'
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`
const USER_AGENT = 'ccc2-updater'
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const STARTUP_DELAY_MS = 10_000
const FETCH_TIMEOUT_MS = 10_000

const INSTALL_COMMAND =
  `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --relaunch`

interface GitHubRelease {
  tag_name: string
  html_url: string
  body: string
  published_at: string
}

class Updater {
  private state: UpdaterState = {
    status: 'idle',
    currentVersion: app.getVersion()
  }
  private intervalHandle: NodeJS.Timeout | null = null
  private startupHandle: NodeJS.Timeout | null = null

  getState(): UpdaterState {
    return this.state
  }

  start(): void {
    this.startupHandle = setTimeout(() => {
      void this.check()
    }, STARTUP_DELAY_MS)

    this.intervalHandle = setInterval(() => {
      void this.check()
    }, CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.startupHandle) clearTimeout(this.startupHandle)
    if (this.intervalHandle) clearInterval(this.intervalHandle)
    this.startupHandle = null
    this.intervalHandle = null
  }

  async check(): Promise<UpdaterState> {
    this.setState({ ...this.state, status: 'checking', errorMessage: undefined })

    try {
      const release = await this.fetchLatestRelease()
      const latest = release.tag_name.replace(/^v/, '')
      const current = app.getVersion()
      const lastCheckedAt = new Date().toISOString()

      if (semver.valid(latest) && semver.gt(latest, current)) {
        this.setState({
          status: 'update-available',
          currentVersion: current,
          latestVersion: latest,
          releaseUrl: release.html_url,
          releaseNotes: release.body,
          publishedAt: release.published_at,
          lastCheckedAt
        })
      } else {
        this.setState({
          status: 'up-to-date',
          currentVersion: current,
          latestVersion: latest,
          lastCheckedAt
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error(`Updater check failed: ${message}`)
      this.setState({
        ...this.state,
        status: 'error',
        errorMessage: message,
        lastCheckedAt: new Date().toISOString()
      })
    }

    return this.state
  }

  install(): UpdaterInstallResult {
    if (process.platform === 'win32') {
      return { manual: true, command: INSTALL_COMMAND }
    }

    // Spawn a detached shell that waits briefly (so IPC reply flushes + app quits
    // cleanly), then runs install.sh with --relaunch. stdio is ignored so the
    // child outlives the parent.
    const child = spawn(
      'bash',
      ['-c', `sleep 1 && ${INSTALL_COMMAND}`],
      {
        detached: true,
        stdio: 'ignore'
      }
    )
    child.unref()

    setTimeout(() => app.quit(), 200)

    return {}
  }

  private async fetchLatestRelease(): Promise<GitHubRelease> {
    const res = await fetch(RELEASE_API, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/vnd.github+json'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })

    if (!res.ok) {
      throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
    }

    return (await res.json()) as GitHubRelease
  }

  private setState(next: UpdaterState): void {
    this.state = next
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('updater:state-changed', this.state)
    }
  }
}

let updaterInstance: Updater | null = null

export function getUpdater(): Updater {
  if (!updaterInstance) {
    updaterInstance = new Updater()
  }
  return updaterInstance
}

export function initUpdater(): void {
  getUpdater().start()
}
