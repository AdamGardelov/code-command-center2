import { watch, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import type { SessionStatus } from '../shared/types'
import type { BrowserWindow } from 'electron'

const STATES_DIR = join(process.env.HOME ?? '', '.ccc', 'states')

const VALID_STATES: Record<string, SessionStatus> = {
  idle: 'idle',
  working: 'working',
  waiting: 'waiting'
}

const HOOK_TO_STATUS: Record<string, SessionStatus | undefined> = {
  'alert-activity': 'working',
  'alert-silence': 'idle',
  'pane-died': 'error'
}

export class StateDetector {
  private window: BrowserWindow | null = null
  private watcher: ReturnType<typeof watch> | null = null
  private states: Map<string, SessionStatus> = new Map()

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  start(): void {
    if (!existsSync(STATES_DIR)) {
      mkdirSync(STATES_DIR, { recursive: true })
    }

    this.scanAll()

    try {
      this.watcher = watch(STATES_DIR, (_eventType, filename) => {
        if (!filename) return
        this.readState(filename)
      })
    } catch {
      setInterval(() => this.scanAll(), 2000)
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  getState(sessionName: string): SessionStatus {
    return this.states.get(sessionName) ?? 'idle'
  }

  /**
   * Map a tmux server-side hook event into a session status. Called by the
   * EventSocket consumer when tmux fires alert-activity / alert-silence /
   * pane-died on a CCC-managed session.
   */
  handleHookEvent(kind: string, sessionName: string): void {
    const status = HOOK_TO_STATUS[kind]
    if (!status) return
    const prev = this.states.get(sessionName)
    this.states.set(sessionName, status)
    if (prev !== status) this.emit(sessionName, status)
  }

  analyzeContent(sessionName: string, lastLine: string): void {
    if (this.states.has(sessionName)) return

    let detected: SessionStatus = 'working'
    const trimmed = lastLine.trim()

    if (trimmed.endsWith('\u276F') || trimmed.endsWith('$') || trimmed.endsWith('%')) {
      detected = 'idle'
    }

    const current = this.states.get(sessionName)
    if (current !== detected) {
      this.states.set(sessionName, detected)
      this.emit(sessionName, detected)
    }
  }

  private scanAll(): void {
    try {
      const files = readdirSync(STATES_DIR)
      for (const file of files) {
        this.readState(file)
      }
    } catch {
      // Directory may not exist yet
    }
  }

  private readState(filename: string): void {
    const filepath = join(STATES_DIR, filename)
    try {
      const content = readFileSync(filepath, 'utf-8').trim()
      const status = VALID_STATES[content]
      if (!status) return

      const prev = this.states.get(filename)
      this.states.set(filename, status)

      if (prev !== status) {
        this.emit(filename, status)
      }
    } catch {
      // File may have been deleted
    }
  }

  private emit(sessionName: string, status: SessionStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('session:state-changed', sessionName, status)
    }
  }
}
