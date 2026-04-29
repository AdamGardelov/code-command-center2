export interface DataSink {
  send(sessionId: string, data: string): void
}

interface Buffer {
  chunks: string[]
  size: number
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * Coalesces PTY output bursts into one IPC send per ~frame. Each
 * `terminal:data` IPC call structured-clones the payload across the main↔
 * renderer boundary, which becomes the bottleneck during heavy bursts (long
 * agent streams, build output). Buffering for 16 ms (one frame) or 64 KB —
 * whichever comes first — keeps perceived output latency unchanged while
 * collapsing hundreds of tiny sends into one.
 *
 * OSC parsing stays inline on the raw chunk so state hints aren't delayed by
 * the buffer window.
 */
export class PtyCoalescer {
  private buffers: Map<string, Buffer> = new Map()

  constructor(
    private sink: DataSink,
    private flushMs: number = 16,
    private maxBytes: number = 64 * 1024
  ) {}

  push(sessionId: string, data: string): void {
    if (data.length === 0) return
    let entry = this.buffers.get(sessionId)
    if (!entry) {
      entry = { chunks: [], size: 0, timer: null }
      this.buffers.set(sessionId, entry)
    }
    entry.chunks.push(data)
    entry.size += data.length
    if (entry.size >= this.maxBytes) {
      this.flush(sessionId)
      return
    }
    if (entry.timer === null) {
      entry.timer = setTimeout(() => this.flush(sessionId), this.flushMs)
    }
  }

  flush(sessionId: string): void {
    const entry = this.buffers.get(sessionId)
    if (!entry || entry.chunks.length === 0) return
    const payload = entry.chunks.join('')
    entry.chunks = []
    entry.size = 0
    if (entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    this.sink.send(sessionId, payload)
  }

  flushAll(): void {
    for (const id of this.buffers.keys()) {
      this.flush(id)
    }
  }

  clear(sessionId: string): void {
    const entry = this.buffers.get(sessionId)
    if (!entry) return
    if (entry.timer !== null) clearTimeout(entry.timer)
    this.buffers.delete(sessionId)
  }

  clearAll(): void {
    for (const entry of this.buffers.values()) {
      if (entry.timer !== null) clearTimeout(entry.timer)
    }
    this.buffers.clear()
  }
}
