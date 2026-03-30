import { execFileSync } from 'child_process'
import type { Session, SessionCreate } from '../shared/types'

// Muted, distinguishable palette that works on dark backgrounds
const SESSION_COLORS = [
  '#88a1bb', // blue
  '#b7bd73', // green
  '#e9c880', // yellow
  '#bf6b69', // red
  '#ad95b8', // magenta
  '#95bdb7', // cyan
  '#c55757', // bright red
  '#83a5d6', // bright blue
  '#bcc95f', // bright green
  '#bc99d4', // bright magenta
  '#83beb1', // bright cyan
  '#e1c65e', // bright yellow
]

function tmux(...args: string[]): string | null {
  try {
    return execFileSync('tmux', args, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return null
  }
}

function isTmuxInstalled(): boolean {
  try {
    execFileSync('which', ['tmux'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

function isClaudeInstalled(): boolean {
  try {
    execFileSync('which', ['claude'], { encoding: 'utf-8' })
    return true
  } catch {
    return false
  }
}

function getGitBranch(dir: string): string | undefined {
  try {
    const expanded = dir.replace(/^~/, process.env.HOME ?? '')
    return (
      execFileSync('git', ['-C', expanded, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf-8',
        timeout: 3000
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

function generateId(): string {
  return `ccc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const PREFIX = 'ccc-'

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private colorIndex = 0

  checkDependencies(): { tmux: boolean; claude: boolean } {
    return { tmux: isTmuxInstalled(), claude: isClaudeInstalled() }
  }

  private nextColor(): string {
    const color = SESSION_COLORS[this.colorIndex % SESSION_COLORS.length]
    this.colorIndex++
    return color
  }

  private applyTmuxColor(tmuxName: string, color: string): void {
    // Set session-level status bar color
    tmux('set-option', '-t', tmuxName, 'status-style', `bg=${color},fg=#1d1f21`)
    // Also set left/right status to match
    tmux('set-option', '-t', tmuxName, 'status-left-style', `bg=${color},fg=#1d1f21`)
    tmux('set-option', '-t', tmuxName, 'status-right-style', `bg=${color},fg=#1d1f21`)
  }

  async list(): Promise<Session[]> {
    const output = tmux(
      'list-sessions',
      '-F',
      '#{session_name}\t#{session_created}\t#{pane_current_path}'
    )
    if (!output) return Array.from(this.sessions.values()).filter((s) => s.status !== 'stopped')

    const tmuxSessions = new Set<string>()

    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath] = line.split('\t')
      if (!name?.startsWith(PREFIX)) continue

      tmuxSessions.add(name)
      const existing = this.findByTmuxName(name)

      if (existing) {
        existing.workingDirectory = currentPath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        existing.gitBranch = getGitBranch(existing.workingDirectory)
        if (existing.status === 'error') existing.status = 'idle'
      } else {
        const created = createdStr ? parseInt(createdStr) * 1000 : Date.now()
        const color = this.nextColor()
        this.applyTmuxColor(name, color)
        const session: Session = {
          id: generateId(),
          name: name.slice(PREFIX.length),
          workingDirectory: currentPath || '~',
          status: 'idle',
          type: 'claude',
          color,
          gitBranch: getGitBranch(currentPath || '~'),
          createdAt: created,
          lastActiveAt: Date.now()
        }
        this.sessions.set(session.id, session)
      }
    }

    for (const session of this.sessions.values()) {
      const tmuxName = PREFIX + session.name
      if (!tmuxSessions.has(tmuxName) && session.status !== 'stopped') {
        session.status = 'stopped'
      }
    }

    return Array.from(this.sessions.values())
      .filter((s) => s.status !== 'stopped')
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async create(opts: SessionCreate): Promise<Session> {
    const tmuxName = PREFIX + opts.name
    const expandedDir = opts.workingDirectory.replace(/^~/, process.env.HOME ?? '')

    const args = [
      'new-session',
      '-d',
      '-s',
      tmuxName,
      '-c',
      expandedDir,
      '-e',
      `CCC_SESSION_NAME=${opts.name}`
    ]

    if (opts.type === 'claude') {
      args.push('--', 'claude')
    }

    // Create the session
    tmux(...args)

    // Configure tmux to follow the latest client size (no stale dimensions)
    tmux('set-option', '-t', tmuxName, 'window-size', 'latest')
    tmux('set-option', '-t', tmuxName, 'aggressive-resize', 'on')

    const check = tmux('has-session', '-t', `=${tmuxName}`)
    if (check === null) {
      throw new Error(`Failed to create tmux session: ${tmuxName}`)
    }

    const color = this.nextColor()
    this.applyTmuxColor(tmuxName, color)

    const session: Session = {
      id: generateId(),
      name: opts.name,
      workingDirectory: opts.workingDirectory,
      status: opts.type === 'claude' ? 'working' : 'idle',
      type: opts.type,
      color,
      gitBranch: getGitBranch(expandedDir),
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }

    this.sessions.set(session.id, session)
    return session
  }

  async kill(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return

    const tmuxName = PREFIX + session.name
    tmux('kill-session', '-t', `=${tmuxName}`)
    session.status = 'stopped'
    this.sessions.delete(id)
  }

  getById(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getTmuxName(id: string): string | undefined {
    const session = this.sessions.get(id)
    return session ? PREFIX + session.name : undefined
  }

  updateStatus(sessionName: string, status: Session['status']): void {
    for (const session of this.sessions.values()) {
      if (session.name === sessionName) {
        session.status = status
        break
      }
    }
  }

  private findByTmuxName(tmuxName: string): Session | undefined {
    const name = tmuxName.slice(PREFIX.length)
    for (const session of this.sessions.values()) {
      if (session.name === name) return session
    }
    return undefined
  }
}
