import type { SessionStatus } from '../shared/types'
import type { BrowserWindow } from 'electron'

const HOOK_TO_STATUS: Record<string, SessionStatus | undefined> = {
  // Tmux server-side hooks
  'alert-activity': 'working',
  'alert-silence': 'idle',
  'pane-died': 'error',
  // Agent / TUI lifecycle events (delivered via the unix socket from the user's
  // tool config — Claude Code, Codex, Gemini, or any TUI that can run a shell
  // command on state change). See scripts/migrate-legacy-state-hooks.sh for
  // the canonical hook command shape.
  'agent-idle': 'idle',
  'agent-working': 'working',
  'agent-waiting': 'waiting'
}

export class StateDetector {
  private window: BrowserWindow | null = null
  private states: Map<string, SessionStatus> = new Map()

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  getState(sessionName: string): SessionStatus {
    return this.states.get(sessionName) ?? 'idle'
  }

  /**
   * Map a hook event (tmux server-side or Claude Code) into a session status.
   */
  handleHookEvent(kind: string, sessionName: string): void {
    const status = HOOK_TO_STATUS[kind]
    if (!status) return
    const prev = this.states.get(sessionName)
    this.states.set(sessionName, status)
    if (prev !== status) this.emit(sessionName, status)
  }

  /**
   * Heuristic content-based detection still used by the attached PTY pipeline
   * (terminal:content-snapshot IPC). Only sets state when we have no record yet
   * — push events from the unix socket always win.
   */
  analyzeContent(sessionName: string, lastLine: string): void {
    if (this.states.has(sessionName)) return

    let detected: SessionStatus = 'working'
    const trimmed = lastLine.trim()

    if (trimmed.endsWith('❯') || trimmed.endsWith('$') || trimmed.endsWith('%')) {
      detected = 'idle'
    }

    const current = this.states.get(sessionName)
    if (current !== detected) {
      this.states.set(sessionName, detected)
      this.emit(sessionName, detected)
    }
  }

  private emit(sessionName: string, status: SessionStatus): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('session:state-changed', sessionName, status)
    }
  }
}
