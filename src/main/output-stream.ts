import { createServer, type Server, type Socket } from 'net'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { EventEmitter } from 'events'

/**
 * Receives raw pane output from `tmux pipe-pane` over a unix domain socket.
 *
 * Tmux invokes a per-pipe shell command of the form:
 *   { printf 'session:#{session_name}\n'; cat; } | nc -U <path>
 *
 * Each connection therefore starts with one ASCII header line identifying the
 * session, followed by raw pane bytes (binary, possibly containing newlines
 * and ANSI escapes) until the writer disconnects. We emit `output` for each
 * chunk of post-header bytes, tagged with the session name, so the consumer
 * (typically `OscParser`) can run the same parsing it does for attached PTYs.
 *
 * One server socket, multiplexed by header — keeps the file-descriptor count
 * bounded regardless of how many sessions are active.
 */
export class OutputStream extends EventEmitter {
  private server: Server | null = null
  private clients: Set<Socket> = new Set()

  constructor(public readonly path: string) {
    super()
  }

  async start(): Promise<void> {
    if (existsSync(this.path)) {
      try {
        await unlink(this.path)
      } catch {
        // Stale socket from a previous crash; safe to ignore.
      }
    }
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => this.onConnection(socket))
      server.once('error', reject)
      server.listen(this.path, () => {
        server.off('error', reject)
        this.server = server
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    for (const c of this.clients) {
      try {
        c.destroy()
      } catch {
        // ignore
      }
    }
    this.clients.clear()
    const srv = this.server
    this.server = null
    if (srv) {
      await new Promise<void>((resolve) => srv.close(() => resolve()))
    }
    if (existsSync(this.path)) {
      try {
        await unlink(this.path)
      } catch {
        // ignore
      }
    }
  }

  private onConnection(socket: Socket): void {
    this.clients.add(socket)
    let headerBuf = Buffer.alloc(0)
    let sessionName: string | null = null

    const cleanup = (): void => {
      this.clients.delete(socket)
    }
    socket.on('close', cleanup)
    socket.on('error', cleanup)

    socket.on('data', (chunk: Buffer) => {
      if (sessionName !== null) {
        this.emit('output', sessionName, chunk)
        return
      }
      // Still looking for the header newline.
      headerBuf = Buffer.concat([headerBuf, chunk])
      const nl = headerBuf.indexOf(0x0a)
      if (nl < 0) {
        // Cap header length so a buggy writer can't blow memory.
        if (headerBuf.length > 256) {
          socket.destroy()
        }
        return
      }
      const headerLine = headerBuf.slice(0, nl).toString('utf-8').trim()
      const remainder = headerBuf.slice(nl + 1)
      if (!headerLine.startsWith('session:')) {
        socket.destroy()
        return
      }
      sessionName = headerLine.slice('session:'.length)
      if (remainder.length > 0) {
        this.emit('output', sessionName, remainder)
      }
    })
  }
}
