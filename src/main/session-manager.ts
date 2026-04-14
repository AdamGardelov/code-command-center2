import { execFileSync, spawn } from 'child_process'
import type { Session, SessionCreate, SessionType, RemoteHost } from '../shared/types'
import type { SshService } from './ssh-service'
import type { ContainerService } from './container-service'

function buildClaudeCmd(skipPerms: boolean, autoMode: boolean): string {
  let cmd = 'claude'
  if (autoMode) cmd += ' --permission-mode auto'
  if (skipPerms) cmd += ' --dangerously-skip-permissions'
  return cmd
}

function buildCodexCmd(fullAuto: boolean, dangerBypass: boolean): string {
  let cmd = 'codex'
  if (fullAuto) cmd += ' --full-auto'
  if (dangerBypass) cmd += ' --dangerously-bypass-approvals-and-sandbox'
  return cmd
}

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
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

function getRepoRoot(dir: string): string | undefined {
  try {
    const expanded = dir.replace(/^~/, process.env.HOME ?? '')
    return (
      execFileSync('git', ['-C', expanded, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

function generateId(): string {
  return `ccc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isValidContainerName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)
}

const PREFIX = 'ccc-'

/** Separator used in tmux list-sessions format strings — must not appear in session names or paths */
const SEP = '|||'

/** Tmux replaces dots with underscores in session names, so we must do the same */
function tmuxSessionName(name: string): string {
  return PREFIX + name.replace(/\./g, '_')
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private colorIndex = 0
  private configService: { get(): { sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; remoteHosts?: RemoteHost[]; dangerouslySkipPermissions: boolean; enableAutoMode: boolean; codexFullAuto: boolean; codexDangerouslyBypassApprovals: boolean; ideCommand?: string; containerSessions?: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; containerSessions: Record<string, string> }>): void; resolveClaudeConfigDir(workingDirectory: string): string | undefined } | null = null
  private sshService: SshService | null = null
  private containerService: ContainerService | null = null

  setConfigService(service: { get(): { sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; remoteHosts?: RemoteHost[]; dangerouslySkipPermissions: boolean; enableAutoMode: boolean; codexFullAuto: boolean; codexDangerouslyBypassApprovals: boolean; ideCommand?: string; containerSessions?: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; containerSessions: Record<string, string> }>): void; resolveClaudeConfigDir(workingDirectory: string): string | undefined }): void {
    this.configService = service
  }

  setSshService(service: SshService): void {
    this.sshService = service
  }

  setContainerService(service: ContainerService): void {
    this.containerService = service
  }

  private tmuxCmd(remoteHost: string | undefined, ...args: string[]): string | null {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      // Shell-escape each argument for remote execution
      const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
      return this.sshService.exec(sshHost, `tmux ${escaped}`)
    }
    return tmux(...args)
  }

  checkDependencies(): { tmux: boolean; claude: boolean } {
    return { tmux: isTmuxInstalled(), claude: isClaudeInstalled() }
  }

  private getColorForSession(sessionName: string): string {
    const saved = this.configService?.get().sessionColors[sessionName]
    if (saved) return saved
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

  private listRemote(hostName: string, sshHost: string): Session[] {
    if (!this.sshService) return []
    const output = this.sshService.exec(
      sshHost,
      `tmux list-sessions -F "#{session_name}${SEP}#{session_created}${SEP}#{pane_current_path}"`
    )
    if (!output) return []

    const sessions: Session[] = []
    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath] = line.split(SEP)
      if (!name?.startsWith(PREFIX)) continue

      const sessionName = name.slice(PREFIX.length)
      // Check if we already track this remote session
      const existing = this.findByTmuxNameAndHost(sessionName, hostName)
      const containerSessions = this.configService?.get().containerSessions ?? {}
      if (existing) {
        existing.workingDirectory = currentPath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        if (existing.status === 'error') existing.status = 'idle'
        const containerName = containerSessions[existing.name]
        if (containerName) {
          existing.isContainer = true
          existing.containerName = containerName
        } else {
          existing.isContainer = false
          existing.containerName = undefined
        }
        sessions.push(existing)
      } else {
        const created = createdStr ? parseInt(createdStr) * 1000 : Date.now()
        const color = this.getColorForSession(sessionName)
        const remoteContainerName = containerSessions[sessionName]
        const session: Session = {
          id: generateId(),
          name: sessionName,
          workingDirectory: currentPath || '~',
          status: 'idle',
          type: this.configService?.get().sessionTypes[sessionName] ?? 'claude',
          color,
          remoteHost: hostName,
          isContainer: !!remoteContainerName,
          containerName: remoteContainerName,
          createdAt: created,
          lastActiveAt: Date.now()
        }
        this.sessions.set(session.id, session)
        sessions.push(session)
      }
    }
    return sessions
  }

  async list(): Promise<Session[]> {
    const output = tmux(
      'list-sessions',
      '-F',
      `#{session_name}${SEP}#{session_created}${SEP}#{pane_current_path}`
    )
    if (!output) return Array.from(this.sessions.values()).filter((s) => s.status !== 'stopped')

    const tmuxSessions = new Set<string>()

    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath] = line.split(SEP)
      if (!name?.startsWith(PREFIX)) continue

      tmuxSessions.add(name)
      const existing = this.findByTmuxName(name)

      const containerSessions = this.configService?.get().containerSessions ?? {}
      if (existing) {
        existing.workingDirectory = currentPath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        existing.gitBranch = getGitBranch(existing.workingDirectory)
        existing.repoPath = getRepoRoot(existing.workingDirectory)
        if (existing.status === 'error') existing.status = 'idle'
        if (containerSessions[existing.name]) {
          existing.isContainer = true
          existing.containerName = containerSessions[existing.name]
        } else {
          existing.isContainer = false
          existing.containerName = undefined
        }
      } else {
        const created = createdStr ? parseInt(createdStr) * 1000 : Date.now()
        const sessionName = name.slice(PREFIX.length)
        const color = this.getColorForSession(sessionName)
        this.applyTmuxColor(name, color)
        this.configService?.update({ sessionColors: { [sessionName]: color } })
        const containerName = containerSessions[sessionName]
        const session: Session = {
          id: generateId(),
          name: sessionName,
          workingDirectory: currentPath || '~',
          status: 'idle',
          type: this.configService?.get().sessionTypes[sessionName] ?? 'claude',
          color,
          isContainer: !!containerName,
          containerName,
          gitBranch: getGitBranch(currentPath || '~'),
          repoPath: getRepoRoot(currentPath || '~'),
          createdAt: created,
          lastActiveAt: Date.now()
        }
        this.sessions.set(session.id, session)
      }
    }

    // Mark stopped local sessions and clean up container mappings
    for (const session of this.sessions.values()) {
      if (session.remoteHost) continue
      const tmuxName = tmuxSessionName(session.name)
      if (!tmuxSessions.has(tmuxName) && session.status !== 'stopped') {
        session.status = 'stopped'
        if (this.configService?.get().containerSessions?.[session.name]) {
          const containerSessions = { ...this.configService?.get().containerSessions }
          delete containerSessions[session.name]
          this.configService?.update({ containerSessions })
        }
      }
    }

    // Enumerate remote sessions
    const remoteHosts = this.configService?.get().remoteHosts ?? []
    const remoteSessionIds = new Set<string>()
    for (const rh of remoteHosts) {
      const remoteSessions = this.listRemote(rh.name, rh.host)
      for (const s of remoteSessions) remoteSessionIds.add(s.id)
    }

    // Mark stopped remote sessions that no longer appear
    for (const session of this.sessions.values()) {
      if (session.remoteHost && !remoteSessionIds.has(session.id) && session.status !== 'stopped') {
        session.status = 'stopped'
      }
    }

    return Array.from(this.sessions.values())
      .filter((s) => s.status !== 'stopped')
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  async create(opts: SessionCreate): Promise<Session> {
    if (opts.containerName && !isValidContainerName(opts.containerName)) {
      throw new Error(`Invalid container name: ${opts.containerName}`)
    }
    if (opts.containerName && this.containerService) {
      const running = this.containerService.isRunning(opts.containerName, opts.remoteHost, true)
      if (!running) {
        throw new Error(`Container "${opts.containerName}" is not running`)
      }
    }
    const tmuxName = tmuxSessionName(opts.name)
    const expandedDir = opts.workingDirectory.replace(/^~/, process.env.HOME ?? '')
    const isRemote = !!opts.remoteHost

    // Check for duplicate session name
    const existingTmux = isRemote
      ? this.tmuxCmd(opts.remoteHost, 'has-session', '-t', `=${tmuxName}`)
      : tmux('has-session', '-t', `=${tmuxName}`)
    if (existingTmux !== null) {
      throw new Error(`Session "${opts.name}" already exists`)
    }

    if (isRemote) {
      // Remote session creation via SSH
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === opts.remoteHost)
      const remoteShell = hostConfig?.shell || '/bin/bash'
      const newArgs = ['new-session', '-d', '-s', tmuxName, '-c', opts.workingDirectory, '-e', `CCC_SESSION_NAME=${opts.name}`]

      if (!opts.containerName) {
        const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
        if (claudeConfigDir) {
          newArgs.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
        }
      }

      if (opts.containerName) {
        const cfg = this.configService?.get()
        const cmd = opts.type === 'claude'
          ? buildClaudeCmd(
              opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
              opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
            )
          : opts.type === 'gemini'
            ? 'gemini'
            : opts.type === 'codex'
              ? buildCodexCmd(
                  opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
                  opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
                )
              : ''
        const dockerCmd = `docker exec -it -e CCC_SESSION_NAME=${opts.name} -w ${opts.workingDirectory} ${opts.containerName} zsh -lic '${cmd || 'exec zsh'}'`
        newArgs.push('--', remoteShell, '-ic', dockerCmd)
      } else if (opts.type === 'claude') {
        const cfg = this.configService?.get()
        const cmd = buildClaudeCmd(
          opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
          opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
        )
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && ${cmd}`)
      }
      else if (opts.type === 'gemini') {
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && gemini`)
      }
      else if (opts.type === 'codex') {
        const cfg = this.configService?.get()
        const cmd = buildCodexCmd(
          opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
          opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
        )
        newArgs.push('--', remoteShell, '-ic', `cd ${opts.workingDirectory} && ${cmd}`)
      }

      this.tmuxCmd(opts.remoteHost, ...newArgs)
      this.tmuxCmd(opts.remoteHost, 'set-option', '-t', tmuxName, 'window-size', 'latest')
      this.tmuxCmd(opts.remoteHost, 'set-option', '-t', tmuxName, 'aggressive-resize', 'on')
      this.tmuxCmd(opts.remoteHost, 'set-environment', '-t', tmuxName, 'COLORTERM', 'truecolor')
      this.tmuxCmd(opts.remoteHost, 'set-environment', '-t', tmuxName, 'TERM', 'xterm-256color')

      const check = this.tmuxCmd(opts.remoteHost, 'has-session', '-t', tmuxName)
      if (check === null) {
        throw new Error(`Failed to create remote tmux session: ${tmuxName} on ${opts.remoteHost}`)
      }
    } else {
      // Local session creation
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

      if (!opts.containerName) {
        const claudeConfigDir = this.configService?.resolveClaudeConfigDir(opts.workingDirectory)
        if (claudeConfigDir) {
          args.push('-e', `CLAUDE_CONFIG_DIR=${claudeConfigDir}`)
        }
      }

      if (opts.containerName) {
        const cfg = this.configService?.get()
        const cmd = opts.type === 'claude'
          ? buildClaudeCmd(
              opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
              opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
            )
          : opts.type === 'gemini'
            ? 'gemini'
            : opts.type === 'codex'
              ? buildCodexCmd(
                  opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
                  opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
                )
              : ''
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', `docker exec -it -e CCC_SESSION_NAME=${opts.name} -w ${expandedDir} ${opts.containerName} zsh -lic '${cmd || "exec zsh"}'`)
      } else if (opts.type === 'claude') {
        const cfg = this.configService?.get()
        const cmd = buildClaudeCmd(
          opts.skipPermissions ?? cfg?.dangerouslySkipPermissions ?? false,
          opts.enableAutoMode ?? cfg?.enableAutoMode ?? false
        )
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', cmd)
      } else if (opts.type === 'gemini') {
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', 'gemini')
      } else if (opts.type === 'codex') {
        const cfg = this.configService?.get()
        const cmd = buildCodexCmd(
          opts.codexFullAuto ?? cfg?.codexFullAuto ?? false,
          opts.codexDangerBypass ?? cfg?.codexDangerouslyBypassApprovals ?? false
        )
        const shell = process.env.SHELL || '/bin/bash'
        args.push('--', shell, '-ic', cmd)
      }

      tmux(...args)
      tmux('set-option', '-t', tmuxName, 'window-size', 'latest')
      tmux('set-option', '-t', tmuxName, 'aggressive-resize', 'on')
      tmux('set-environment', '-t', tmuxName, 'COLORTERM', 'truecolor')
      tmux('set-environment', '-t', tmuxName, 'TERM', 'xterm-256color')

      const check = tmux('has-session', '-t', `=${tmuxName}`)
      if (check === null) {
        throw new Error(`Failed to create tmux session: ${tmuxName}`)
      }

      this.applyTmuxColor(tmuxName, this.getColorForSession(opts.name))
    }

    const color = this.getColorForSession(opts.name)
    this.configService?.update({
      sessionColors: { [opts.name]: color },
      sessionTypes: { [opts.name]: opts.type }
    })

    if (opts.containerName) {
      const containerSessions = { ...this.configService?.get().containerSessions, [opts.name]: opts.containerName }
      this.configService?.update({ containerSessions })
    } else if (this.configService?.get().containerSessions?.[opts.name]) {
      // Clean up stale container mapping from a previous session with the same name
      const containerSessions = { ...this.configService?.get().containerSessions }
      delete containerSessions[opts.name]
      this.configService?.update({ containerSessions })
    }

    const session: Session = {
      id: generateId(),
      name: opts.name,
      workingDirectory: opts.workingDirectory,
      status: opts.type === 'shell' ? 'idle' : 'working',
      type: opts.type,
      color,
      remoteHost: opts.remoteHost,
      isContainer: !!opts.containerName,
      containerName: opts.containerName,
      skipPermissions: (opts.skipPermissions ?? this.configService?.get().dangerouslySkipPermissions) && opts.type === 'claude' ? true : undefined,
      enableAutoMode: (opts.enableAutoMode ?? this.configService?.get().enableAutoMode) && opts.type === 'claude' ? true : undefined,
      codexFullAuto: (opts.codexFullAuto ?? this.configService?.get().codexFullAuto) && opts.type === 'codex' ? true : undefined,
      codexDangerBypass: (opts.codexDangerBypass ?? this.configService?.get().codexDangerouslyBypassApprovals) && opts.type === 'codex' ? true : undefined,
      gitBranch: isRemote ? undefined : getGitBranch(expandedDir),
      repoPath: isRemote ? undefined : getRepoRoot(expandedDir),
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }

    this.sessions.set(session.id, session)
    return session
  }

  async kill(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return

    const tmuxName = tmuxSessionName(session.name)
    this.tmuxCmd(session.remoteHost, 'kill-session', '-t', `=${tmuxName}`)
    session.status = 'stopped'
    this.sessions.delete(id)

    const config = this.configService?.get()
    if (config?.containerSessions?.[session.name]) {
      const containerSessions = { ...config.containerSessions }
      delete containerSessions[session.name]
      this.configService?.update({ containerSessions })
    }
  }

  getById(id: string): Session | undefined {
    return this.sessions.get(id)
  }

  getTmuxName(id: string): string | undefined {
    const session = this.sessions.get(id)
    return session ? tmuxSessionName(session.name) : undefined
  }

  updateStatus(sessionName: string, status: Session['status']): void {
    for (const session of this.sessions.values()) {
      if (session.name === sessionName) {
        session.status = status
        break
      }
    }
  }

  getSessionInfo(id: string): { tmuxName: string; remoteHost?: string } | undefined {
    const session = this.sessions.get(id)
    if (!session) return undefined
    const hostConfig = session.remoteHost
      ? this.configService?.get().remoteHosts?.find(h => h.name === session.remoteHost)
      : undefined
    return {
      tmuxName: tmuxSessionName(session.name),
      remoteHost: hostConfig?.host
    }
  }

  openInIde(id: string): void {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)
    if (session.remoteHost) throw new Error('IDE integration not supported for remote sessions')

    const ideCommand = this.configService?.get().ideCommand
    if (!ideCommand) throw new Error('IDE command not configured. Set it in Settings > Advanced.')

    const dir = session.workingDirectory.replace(/^~/, process.env.HOME ?? '')
    const child = spawn(ideCommand, [dir], { detached: true, stdio: 'ignore' })
    child.unref()
  }

  private findByTmuxName(tmuxName: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (tmuxSessionName(session.name) === tmuxName && !session.remoteHost) return session
    }
    return undefined
  }

  private findByTmuxNameAndHost(sessionName: string, hostName: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.name.replace(/\./g, '_') === sessionName && session.remoteHost === hostName) return session
    }
    return undefined
  }
}
