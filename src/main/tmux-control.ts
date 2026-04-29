import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { TMUX_SOCKET_NAME } from './tmux-socket'

export interface TmuxSessionSnapshot {
  name: string
  created: number
  currentPath: string
}

interface TmuxControlOptions {
  socketName?: string
  /**
   * Optional SSH command prefix, e.g. `['ssh', '-o', '...', 'host']`.
   * When set, control mode runs on the remote tmux server: the prefix
   * is invoked with the tmux command appended as the final argument.
   */
  sshPrefix?: string[]
}

const SEP = '|||'
const LIST_FMT = `#{session_name}${SEP}#{session_created}${SEP}#{pane_current_path}`

/**
 * Hidden session that owns the control-mode client. Without a stable
 * attachment target the client dies as soon as its target session is
 * destroyed. We create this session lazily and filter it out of every
 * listSessions response.
 */
export const CONTROL_SESSION_NAME = '__ccc-ctl'

interface PendingCommand {
  resolve: (lines: string[]) => void
  reject: (err: Error) => void
}

interface CurrentBlock {
  lines: string[]
  isError: boolean
}

/**
 * Persistent `tmux -C` subscriber. Emits structural events
 * (sessions-changed, session-closed/-opened, window-*, output, client-detached)
 * and supports inline command execution over the same control connection.
 *
 * One instance per host: a local instance for the user's machine and one per
 * configured SSH host.
 */
export class TmuxControl extends EventEmitter {
  private proc: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private pendingCommands: PendingCommand[] = []
  private currentBlock: CurrentBlock | null = null
  private greetingConsumed = false
  private greetingResolve: (() => void) | null = null
  private lastKnownSessions: Map<string, TmuxSessionSnapshot> = new Map()
  private opts: TmuxControlOptions

  constructor(opts: TmuxControlOptions = {}) {
    super()
    this.opts = opts
  }

  isRunning(): boolean {
    return this.proc !== null
  }

  async start(): Promise<void> {
    if (this.proc) return
    const socket = this.opts.socketName ?? TMUX_SOCKET_NAME

    // Ensure the dedicated control session exists; tmux -C attach without a
    // target dies when the most-recently-used session is killed.
    this.ensureControlSession(socket)

    const tmuxCmd = `tmux -L ${socket} -C attach -t ${CONTROL_SESSION_NAME}`

    let cmd: string
    let argv: string[]
    if (this.opts.sshPrefix && this.opts.sshPrefix.length > 0) {
      cmd = this.opts.sshPrefix[0]
      argv = [...this.opts.sshPrefix.slice(1), tmuxCmd]
    } else {
      cmd = 'tmux'
      argv = ['-L', socket, '-C', 'attach', '-t', CONTROL_SESSION_NAME]
    }

    const proc = spawn(cmd, argv, { stdio: ['pipe', 'pipe', 'pipe'] })
    this.proc = proc

    proc.stdout.setEncoding('utf-8')
    proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    proc.stderr.setEncoding('utf-8')
    proc.stderr.on('data', (chunk: string) => this.emit('stderr', chunk))
    proc.on('exit', (code) => {
      this.emit('exit', code)
      const pending = this.pendingCommands.splice(0)
      for (const p of pending) p.reject(new Error(`tmux control mode exited with code ${code}`))
      if (this.greetingResolve) {
        this.greetingResolve()
        this.greetingResolve = null
      }
      this.proc = null
    })

    // Wait for the greeting block (%begin … %end on attach) to clear,
    // then seed the session snapshot. If attach fails (e.g. no server),
    // the proc exits and we surface that to callers.
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => reject(err)
      proc.once('error', onError)
      this.greetingResolve = (): void => {
        proc.off('error', onError)
        resolve()
      }
      proc.once('exit', (code) => {
        if (!this.greetingConsumed) {
          proc.off('error', onError)
          reject(new Error(`tmux control mode exited before greeting (code ${code})`))
        }
      })
    })

    try {
      const list = await this.listSessions()
      this.lastKnownSessions = new Map(list.map((s) => [s.name, s]))
    } catch {
      // No sessions yet, or list failed — leave snapshot empty.
      this.lastKnownSessions = new Map()
    }
  }

  async stop(): Promise<void> {
    const proc = this.proc
    if (!proc) return
    this.proc = null
    return new Promise((resolve) => {
      const done = (): void => resolve()
      proc.once('exit', done)
      try {
        proc.stdin.end()
      } catch {
        // ignore
      }
      try {
        proc.kill('SIGTERM')
      } catch {
        // ignore
      }
      // Belt-and-braces: hard kill after 1s if SIGTERM didn't land.
      setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {
          // ignore
        }
      }, 1000)
    })
  }

  /**
   * Run a tmux command over the persistent control connection.
   * Returns the command's stdout lines (excluding %begin/%end delimiters).
   * Multiple calls are queued and processed FIFO.
   */
  command(cmd: string): Promise<string[]> {
    if (!this.proc) return Promise.reject(new Error('TmuxControl not started'))
    return new Promise((resolve, reject) => {
      this.pendingCommands.push({ resolve, reject })
      try {
        this.proc!.stdin.write(cmd + '\n')
      } catch (err) {
        // Write failed (process gone) — drain pending and reject.
        this.pendingCommands.pop()
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  async listSessions(): Promise<TmuxSessionSnapshot[]> {
    const lines = await this.command(`list-sessions -F "${LIST_FMT}"`)
    return lines
      .filter((l) => l.length > 0)
      .map((l) => {
        const [name, createdStr, currentPath] = l.split(SEP)
        return {
          name,
          created: createdStr ? parseInt(createdStr) * 1000 : 0,
          currentPath: currentPath ?? ''
        }
      })
      .filter((s) => s.name !== CONTROL_SESSION_NAME)
  }

  private ensureControlSession(socket: string): void {
    const args = ['-L', socket, 'new-session', '-d', '-s', CONTROL_SESSION_NAME]
    if (this.opts.sshPrefix && this.opts.sshPrefix.length > 0) {
      const remoteCmd = `tmux -L ${socket} new-session -d -s ${CONTROL_SESSION_NAME} 2>/dev/null || true`
      try {
        execFileSync(this.opts.sshPrefix[0], [...this.opts.sshPrefix.slice(1), remoteCmd], {
          timeout: 5000,
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch {
        // Hook will fail loudly later if attach can't connect.
      }
      return
    }
    try {
      execFileSync('tmux', args, { timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch {
      // Already exists or server start raced with us — attach will tell us.
    }
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk
    let nl = this.buffer.indexOf('\n')
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, '')
      this.buffer = this.buffer.slice(nl + 1)
      this.handleLine(line)
      nl = this.buffer.indexOf('\n')
    }
  }

  private handleLine(line: string): void {
    if (line.startsWith('%begin')) {
      this.currentBlock = { lines: [], isError: false }
      return
    }
    if (line.startsWith('%end') || line.startsWith('%error')) {
      const isError = line.startsWith('%error')
      const block = this.currentBlock
      this.currentBlock = null

      if (!this.greetingConsumed) {
        this.greetingConsumed = true
        const r = this.greetingResolve
        this.greetingResolve = null
        if (r) r()
        return
      }

      const pending = this.pendingCommands.shift()
      if (pending) {
        if (isError) pending.reject(new Error(block?.lines.join('\n') ?? 'tmux error'))
        else pending.resolve(block?.lines ?? [])
      }
      return
    }
    if (this.currentBlock) {
      this.currentBlock.lines.push(line)
      return
    }

    if (line.startsWith('%sessions-changed')) {
      this.emit('sessions-changed')
      void this.refreshSnapshotAndEmitClosures()
      return
    }
    if (line.startsWith('%session-changed')) {
      this.emit('session-changed', line.slice('%session-changed '.length))
      return
    }
    if (line.startsWith('%window-add')) {
      this.emit('window-add', line.slice('%window-add '.length))
      return
    }
    if (line.startsWith('%window-close')) {
      this.emit('window-close', line.slice('%window-close '.length))
      return
    }
    if (line.startsWith('%window-renamed')) {
      this.emit('window-renamed', line.slice('%window-renamed '.length))
      return
    }
    if (line.startsWith('%output')) {
      const rest = line.slice('%output '.length)
      const sp = rest.indexOf(' ')
      const paneId = sp > 0 ? rest.slice(0, sp) : rest
      const data = sp > 0 ? rest.slice(sp + 1) : ''
      this.emit('output', paneId, data)
      return
    }
    if (line.startsWith('%client-detached')) {
      this.emit('client-detached', line.slice('%client-detached '.length))
      return
    }
    if (line.startsWith('%')) this.emit('unknown', line)
  }

  private async refreshSnapshotAndEmitClosures(): Promise<void> {
    let list: TmuxSessionSnapshot[]
    try {
      list = await this.listSessions()
    } catch {
      return
    }
    const next = new Map(list.map((s) => [s.name, s]))
    for (const name of this.lastKnownSessions.keys()) {
      if (!next.has(name)) this.emit('session-closed', name)
    }
    for (const [name, snap] of next) {
      if (!this.lastKnownSessions.has(name)) this.emit('session-opened', name, snap)
    }
    this.lastKnownSessions = next
  }
}
