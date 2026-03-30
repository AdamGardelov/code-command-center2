import * as pty from 'node-pty'
import type { BrowserWindow } from 'electron'
import type { SessionStatus } from '../shared/types'
import { OscParser } from './osc-parser'

interface ActivePty {
  pty: pty.IPty
  sessionId: string
}

export class PtyManager {
  private ptys: Map<string, ActivePty> = new Map()
  private window: BrowserWindow | null = null
  private oscParser: OscParser
  private onStatusChange: ((sessionId: string, status: SessionStatus) => void) | null = null

  constructor() {
    this.oscParser = new OscParser((sessionId, status) => {
      if (this.onStatusChange) {
        this.onStatusChange(sessionId, status)
      }
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('session:state-changed', sessionId, status)
      }
    })
  }

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  setStatusChangeHandler(handler: (sessionId: string, status: SessionStatus) => void): void {
    this.onStatusChange = handler
  }

  attach(sessionId: string, tmuxSessionName: string): void {
    this.detach(sessionId)

    const shell = process.env.SHELL || '/bin/bash'

    // -d detaches other clients so tmux uses THIS client's size
    const ptyProcess = pty.spawn(shell, ['-lc', `tmux attach-session -d -t '=${tmuxSessionName}'`], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' }
    })

    ptyProcess.onData((data) => {
      // Parse OSC sequences inline (fast — no copying, no delay)
      this.oscParser.parse(sessionId, data)

      // Forward data to renderer unchanged
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('terminal:data', sessionId, data)
      }
    })

    ptyProcess.onExit(() => {
      this.oscParser.clear(sessionId)
      this.ptys.delete(sessionId)
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('terminal:exit', sessionId)
      }
    })

    this.ptys.set(sessionId, { pty: ptyProcess, sessionId })
  }

  detach(sessionId: string): void {
    const active = this.ptys.get(sessionId)
    if (!active) return
    try {
      active.pty.kill()
    } catch {
      // Process may already be dead
    }
    this.oscParser.clear(sessionId)
    this.ptys.delete(sessionId)
  }

  write(sessionId: string, data: string): void {
    const active = this.ptys.get(sessionId)
    if (active) {
      active.pty.write(data)
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const active = this.ptys.get(sessionId)
    if (active) {
      active.pty.resize(cols, rows)
    }
  }

  isAttached(sessionId: string): boolean {
    return this.ptys.has(sessionId)
  }

  detachAll(): void {
    for (const [id] of this.ptys) {
      this.detach(id)
    }
  }
}
