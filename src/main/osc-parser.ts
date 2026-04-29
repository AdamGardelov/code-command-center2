import type { SessionStatus } from '../shared/types'

/**
 * Parses OSC (Operating System Command) escape sequences from terminal data
 * to detect Claude Code session status.
 *
 * Claude Code sets the terminal title via OSC 0:
 * - Braille spinner chars (U+2800–U+28FF) as first char = working
 * - ✳ (U+2733) as first char = idle
 *
 * Claude Code sends notifications via OSC 9 (iTerm2):
 * - OSC 9;4;1 / 9;4;2 / 9;4;3 = progress (working)
 * - OSC 9;{text} = notification (may indicate waiting)
 */

// Braille pattern block: U+2800 to U+28FF
const BRAILLE_START = 0x2800
const BRAILLE_END = 0x28ff
const IDLE_CHAR = 0x2733 // ✳

export type OscCallback = (sessionId: string, status: SessionStatus, title?: string) => void
export type ClipboardCallback = (text: string) => void
export type NotificationCallback = (sessionId: string, text: string, at: number) => void

export class OscParser {
  private callback: OscCallback
  private clipboardCallback: ClipboardCallback | null = null
  private notificationCallback: NotificationCallback | null = null
  // Track per-session state to avoid duplicate emissions
  private lastStatus: Map<string, SessionStatus> = new Map()

  constructor(callback: OscCallback) {
    this.callback = callback
  }

  setClipboardCallback(cb: ClipboardCallback): void {
    this.clipboardCallback = cb
  }

  setNotificationCallback(cb: NotificationCallback): void {
    this.notificationCallback = cb
  }

  /**
   * Parse terminal data for OSC sequences. Call this on every PTY data chunk.
   * This is on the hot path — must be fast. We scan for \x1b] and extract
   * only what we need without regex on the full data.
   */
  parse(sessionId: string, data: string): void {
    let searchFrom = 0

    while (searchFrom < data.length) {
      // Find OSC start: ESC ]
      const oscStart = data.indexOf('\x1b]', searchFrom)
      if (oscStart === -1) break

      // Find OSC end: BEL (\x07) or ST (ESC \)
      const payloadStart = oscStart + 2
      let oscEnd = -1

      for (let i = payloadStart; i < data.length; i++) {
        if (data[i] === '\x07') {
          oscEnd = i
          break
        }
        if (data[i] === '\x1b' && i + 1 < data.length && data[i + 1] === '\\') {
          oscEnd = i
          break
        }
      }

      if (oscEnd === -1) {
        // Incomplete OSC — might span across data chunks, skip
        break
      }

      const payload = data.slice(payloadStart, oscEnd)
      searchFrom = oscEnd + 1

      // Parse OSC code (number before first ;)
      const semiPos = payload.indexOf(';')
      if (semiPos === -1) continue

      const code = payload.slice(0, semiPos)
      const value = payload.slice(semiPos + 1)

      if (code === '0' || code === '2') {
        // OSC 0 / OSC 2: Set window title
        this.handleTitle(sessionId, value)
      } else if (code === '9') {
        // OSC 9: iTerm2 notification
        this.handleNotification(sessionId, value)
      } else if (code === '52') {
        // OSC 52: Clipboard set — format: selection;base64data
        this.handleClipboard(value)
      }
    }
  }

  private handleTitle(sessionId: string, title: string): void {
    if (title.length === 0) return

    const firstChar = title.charCodeAt(0)

    if (firstChar >= BRAILLE_START && firstChar <= BRAILLE_END) {
      this.emitIfChanged(sessionId, 'working', title)
    } else if (firstChar === IDLE_CHAR) {
      this.emitIfChanged(sessionId, 'idle', title)
    }
  }

  private handleNotification(sessionId: string, payload: string): void {
    // OSC 9;4;level = progress indicator → working (no human-readable text)
    if (payload.startsWith('4;')) {
      const level = payload.split(';')[1]
      if (level === '1' || level === '2' || level === '3') {
        this.emitIfChanged(sessionId, 'working')
      }
      return
    }

    // Real notification text — surface it for sidebar display.
    if (this.notificationCallback) {
      this.notificationCallback(sessionId, payload, Date.now())
    }

    // Permission/approval prompts also bump us to the waiting state.
    if (payload.toLowerCase().includes('permission') || payload.toLowerCase().includes('approve')) {
      this.emitIfChanged(sessionId, 'waiting')
    }
  }

  private handleClipboard(payload: string): void {
    if (!this.clipboardCallback) return
    // Format: <selection>;<base64-data>  (selection is typically 'c', 'p', 's', etc.)
    const semi = payload.indexOf(';')
    if (semi === -1) return
    const b64 = payload.slice(semi + 1)
    // '?' means query — ignore, we only handle set
    if (!b64 || b64 === '?') return
    try {
      const text = Buffer.from(b64, 'base64').toString('utf-8')
      if (text) this.clipboardCallback(text)
    } catch {
      // Invalid base64 — ignore
    }
  }

  private emitIfChanged(sessionId: string, status: SessionStatus, title?: string): void {
    const prev = this.lastStatus.get(sessionId)
    if (prev !== status) {
      this.lastStatus.set(sessionId, status)
      this.callback(sessionId, status, title)
    }
  }

  clear(sessionId: string): void {
    this.lastStatus.delete(sessionId)
  }
}
