import * as pty from 'node-pty'
import { execFileSync } from 'child_process'
import { join } from 'path'
import { clipboard, type BrowserWindow } from 'electron'
import type { SessionStatus } from '../shared/types'
import { OscParser } from './osc-parser'
import { TMUX_SOCKET_NAME, tmuxArgs } from './tmux-socket'

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
    this.oscParser.setClipboardCallback((text) => {
      clipboard.writeText(text)
    })
  }

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  setStatusChangeHandler(handler: (sessionId: string, status: SessionStatus) => void): void {
    this.onStatusChange = handler
  }

  attach(sessionId: string, tmuxSessionName: string, remoteHost?: string, cols?: number, rows?: number): void {
    this.detach(sessionId)

    const shell = process.env.SHELL || '/bin/bash'
    const c = cols ?? 120
    const r = rows ?? 30

    // Ensure tmux server supports truecolor and forwards OSC 52 clipboard (affects all sessions, idempotent)
    const remoteTmux = `tmux -L ${TMUX_SOCKET_NAME}`
    if (remoteHost) {
      const controlPath = join(process.env.HOME ?? '', '.ccc', 'ssh-%r@%h:%p')
      const sshBase = `ssh -o ControlMaster=auto -o 'ControlPath=${controlPath}' -o ControlPersist=300 -o BatchMode=yes`
      try {
        execFileSync('bash', ['-c', `${sshBase} ${remoteHost} "${remoteTmux} set -g default-terminal 'xterm-256color' 2>/dev/null; ${remoteTmux} set -ga terminal-overrides ',xterm-256color:Tc' 2>/dev/null; ${remoteTmux} set -g set-clipboard on 2>/dev/null; ${remoteTmux} set -ga terminal-overrides ',xterm-256color:Ms=\\\\E]52;%p1%s;%p2%s\\\\7' 2>/dev/null"`], { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch { /* ignore */ }
    } else {
      try {
        execFileSync('tmux', tmuxArgs('set', '-g', 'default-terminal', 'xterm-256color'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set', '-ga', 'terminal-overrides', ',xterm-256color:Tc'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set', '-g', 'set-clipboard', 'on'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set', '-ga', 'terminal-overrides', ',xterm-256color:Ms=\\E]52;%p1%s;%p2%s\\7'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch { /* ignore */ }
    }

    // Set tmux options and environment before attaching
    if (remoteHost) {
      const controlPath = join(process.env.HOME ?? '', '.ccc', 'ssh-%r@%h:%p')
      const sshBase = `ssh -o ControlMaster=auto -o 'ControlPath=${controlPath}' -o ControlPersist=300 -o BatchMode=yes`
      try {
        execFileSync('bash', ['-c', `${sshBase} ${remoteHost} "${remoteTmux} set-option -t '=${tmuxSessionName}' window-size latest 2>/dev/null; ${remoteTmux} set-option -t '=${tmuxSessionName}' aggressive-resize on 2>/dev/null; ${remoteTmux} set-environment -t '=${tmuxSessionName}' COLORTERM truecolor 2>/dev/null; ${remoteTmux} set-environment -t '=${tmuxSessionName}' TERM xterm-256color 2>/dev/null"`], { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch { /* ignore */ }
    } else {
      try {
        execFileSync('tmux', tmuxArgs('set-option', '-t', `=${tmuxSessionName}`, 'window-size', 'latest'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set-option', '-t', `=${tmuxSessionName}`, 'aggressive-resize', 'on'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set-environment', '-t', `=${tmuxSessionName}`, 'COLORTERM', 'truecolor'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
        execFileSync('tmux', tmuxArgs('set-environment', '-t', `=${tmuxSessionName}`, 'TERM', 'xterm-256color'), { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch { /* ignore */ }
    }

    let ptyArgs: string[]
    if (remoteHost) {
      const controlPath = join(process.env.HOME ?? '', '.ccc', 'ssh-%r@%h:%p')
      ptyArgs = ['-lc', `ssh -t -o ControlMaster=auto -o 'ControlPath=${controlPath}' -o ControlPersist=300 ${remoteHost} "${remoteTmux} attach-session -d -t '=${tmuxSessionName}'"`]
    } else {
      ptyArgs = ['-lc', `${remoteTmux} attach-session -d -t '=${tmuxSessionName}'`]
    }

    const ptyProcess = pty.spawn(shell, ptyArgs, {
      name: 'xterm-256color',
      cols: c,
      rows: r,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' }
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

  /**
   * Run pane data through the OSC parser without an attached PTY — used by
   * the OutputStream pipe-pane consumer so detached sessions still get state
   * hints and clipboard updates. The parser dedupes status changes per
   * sessionId, so calling this in parallel with an attached PTY is safe.
   */
  parseOutput(sessionId: string, data: string): void {
    this.oscParser.parse(sessionId, data)
  }
}
