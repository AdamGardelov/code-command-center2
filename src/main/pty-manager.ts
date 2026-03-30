import * as pty from 'node-pty'
import type { BrowserWindow } from 'electron'

interface ActivePty {
  pty: pty.IPty
  sessionId: string
}

export class PtyManager {
  private ptys: Map<string, ActivePty> = new Map()
  private window: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  attach(sessionId: string, tmuxSessionName: string): void {
    this.detach(sessionId)

    const shell = process.env.SHELL || '/bin/bash'

    const ptyProcess = pty.spawn(shell, ['-lc', `tmux attach-session -t '=${tmuxSessionName}'`], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' }
    })

    ptyProcess.onData((data) => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('terminal:data', sessionId, data)
      }
    })

    ptyProcess.onExit(() => {
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
