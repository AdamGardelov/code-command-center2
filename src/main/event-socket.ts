import { createServer, type Server, type Socket } from 'net'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { EventEmitter } from 'events'

/**
 * Listens on a unix domain socket for newline-delimited messages of the form
 * `kind:sessionName`. Tmux server hooks (set-hook -g alert-silence
 * 'run-shell -b "printf alert-silence:#{session_name} | nc -U <path>"')
 * connect, write one line, and close.
 *
 * Multiple events per connection are supported; partial chunks are buffered
 * until a newline arrives.
 */
export class EventSocket extends EventEmitter {
  private server: Server | null = null
  private clients = new Set<Socket>()

  constructor(public readonly path: string) {
    super()
  }

  async start(): Promise<void> {
    if (existsSync(this.path)) {
      try {
        await unlink(this.path)
      } catch {
        // Lingering file from a crash; safe to ignore.
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
    let buf = ''
    socket.setEncoding('utf-8')
    socket.on('data', (chunk: string) => {
      buf += chunk
      let nl = buf.indexOf('\n')
      while (nl !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (line) this.dispatch(line)
        nl = buf.indexOf('\n')
      }
    })
    const cleanup = (): void => {
      this.clients.delete(socket)
    }
    socket.on('close', cleanup)
    socket.on('error', cleanup)
  }

  private dispatch(line: string): void {
    const colon = line.indexOf(':')
    if (colon < 1) return
    const kind = line.slice(0, colon)
    const sessionName = line.slice(colon + 1)
    this.emit('event', kind, sessionName)
  }
}
