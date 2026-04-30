import { execFileSync, spawn } from 'child_process'
import { join } from 'path'
import type { Session, SessionCreate, SessionType, RemoteHost } from '../shared/types'
import type { SshService } from './ssh-service'
import type { ContainerService } from './container-service'
import type { TmuxControl } from './tmux-control'
import { tmuxArgs, tmuxArgsForRemote } from './tmux-socket'
import { isGitDirty } from './git-dirty'

const EVENT_SOCKET_PATH = join(process.env.HOME ?? '', '.ccc', 'events.sock')
const OUTPUT_SOCKET_PATH = join(process.env.HOME ?? '', '.ccc', 'output.sock')

const HOOK_EVENTS = [
  'alert-activity',
  'alert-silence',
  'alert-bell',
  'pane-died',
  'session-closed'
] as const

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
    return execFileSync('tmux', tmuxArgs(...args), { encoding: 'utf-8', timeout: 5000 }).trim()
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

const LIST_FMT = `#{session_name}${SEP}#{session_created}${SEP}#{pane_current_path}${SEP}#{@ccc-state}${SEP}#{@ccc-type}${SEP}#{@ccc-cwd}`

const VALID_STATUSES = new Set<Session['status']>(['idle', 'working', 'waiting', 'stopped', 'error'])
const VALID_TYPES = new Set<SessionType>(['claude', 'gemini', 'shell', 'codex'])

function parseStatus(raw: string | undefined): Session['status'] | undefined {
  if (!raw) return undefined
  return VALID_STATUSES.has(raw as Session['status']) ? (raw as Session['status']) : undefined
}

function parseType(raw: string | undefined): SessionType | undefined {
  if (!raw) return undefined
  return VALID_TYPES.has(raw as SessionType) ? (raw as SessionType) : undefined
}

/** Tmux replaces dots with underscores in session names, so we must do the same */
function tmuxSessionName(name: string): string {
  return PREFIX + name.replace(/\./g, '_')
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private colorIndex = 0
  private configService: { get(): { sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; remoteHosts?: RemoteHost[]; dangerouslySkipPermissions: boolean; enableAutoMode: boolean; codexFullAuto: boolean; codexDangerouslyBypassApprovals: boolean; ideCommand?: string; containerSessions?: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; containerSessions: Record<string, string> }>): void; resolveClaudeConfigDir(workingDirectory: string): string | undefined; pruneSessionName(sessionName: string): void } | null = null
  private sshService: SshService | null = null
  private containerService: ContainerService | null = null
  private localControl: TmuxControl | null = null
  private remoteControls: Map<string, TmuxControl> = new Map()
  private listCacheStale = true
  private listInFlight: Promise<Session[]> | null = null
  private onSessionsChangedCallback: (() => void) | null = null
  private notifications: Map<string, { text: string; at: number }> = new Map()

  /**
   * Record the most recent OSC 9 notification surfaced by an attached PTY.
   * The next list() call attaches it to the matching Session record so the
   * sidebar can render it.
   */
  recordNotification(sessionId: string, text: string, at: number): void {
    this.notifications.set(sessionId, { text, at })
  }

  setConfigService(service: { get(): { sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; remoteHosts?: RemoteHost[]; dangerouslySkipPermissions: boolean; enableAutoMode: boolean; codexFullAuto: boolean; codexDangerouslyBypassApprovals: boolean; ideCommand?: string; containerSessions?: Record<string, string> }; update(p: Partial<{ sessionColors: Record<string, string>; sessionTypes: Record<string, SessionType>; containerSessions: Record<string, string> }>): void; resolveClaudeConfigDir(workingDirectory: string): string | undefined; pruneSessionName(sessionName: string): void }): void {
    this.configService = service
  }

  setSshService(service: SshService): void {
    this.sshService = service
  }

  setContainerService(service: ContainerService): void {
    this.containerService = service
  }

  setLocalControl(control: TmuxControl): void {
    this.localControl = control
    control.on('sessions-changed', () => {
      this.listCacheStale = true
      this.onSessionsChangedCallback?.()
    })
    control.on('session-closed', (name: string) => {
      for (const s of this.sessions.values()) {
        if (!s.remoteHost && tmuxSessionName(s.name) === name) {
          s.status = 'stopped'
        }
      }
      this.listCacheStale = true
      this.onSessionsChangedCallback?.()
    })
  }

  setRemoteControl(hostName: string, control: TmuxControl): void {
    this.remoteControls.set(hostName, control)
    control.on('sessions-changed', () => {
      this.listCacheStale = true
      this.onSessionsChangedCallback?.()
    })
    control.on('session-closed', (name: string) => {
      for (const s of this.sessions.values()) {
        if (s.remoteHost === hostName && tmuxSessionName(s.name) === name) {
          s.status = 'stopped'
        }
      }
      this.listCacheStale = true
      this.onSessionsChangedCallback?.()
    })
  }

  removeRemoteControl(hostName: string): void {
    this.remoteControls.delete(hostName)
  }

  onSessionsChanged(callback: () => void): void {
    this.onSessionsChangedCallback = callback
  }

  invalidateCache(): void {
    this.listCacheStale = true
  }

  /**
   * Install server-wide hooks that emit events to the unix socket. Idempotent.
   * Tmux runs these via `run-shell -b`, which forks per event but is fast on
   * a unix domain socket (sub-millisecond).
   */
  private installServerHooks(remoteHost: string | undefined): void {
    for (const event of HOOK_EVENTS) {
      // `nc -U <path> -w1` connects, sends one line, exits. The `|| true`
      // prevents tmux from dropping the hook chain on any failure (e.g. nc
      // missing or socket unbound while the app is restarting).
      const cmd = `run-shell -b "printf '${event}:#{session_name}\\n' | nc -U ${EVENT_SOCKET_PATH} -w1 2>/dev/null || true"`
      this.tmuxCmd(remoteHost, 'set-hook', '-g', event, cmd)
    }
  }

  /**
   * Configure per-session monitoring so alert-activity / alert-silence fire.
   * Disable visual alerts in tmux itself — the hook is the only consumer.
   */
  private installSessionMonitors(remoteHost: string | undefined, tmuxName: string): void {
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'monitor-silence', '3')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'monitor-activity', 'on')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'visual-activity', 'off')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'visual-silence', 'off')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'activity-action', 'none')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'silence-action', 'none')
  }

  /**
   * Lock window naming and keep the client alive when individual windows die.
   * Without these, agent TUIs constantly rename the window (clobbering the
   * status-bar color) and the client detaches the moment a session's last
   * window exits — wiping the layout the user just built.
   *
   * Also bumps history-limit so capture-pane previews have real scrollback to
   * draw from, and renders the agent state in the pane border so the session
   * status is visible inside tmux itself (useful when attached headless over
   * SSH without the Electron UI).
   */
  private installSessionDefaults(remoteHost: string | undefined, tmuxName: string): void {
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, '-w', 'automatic-rename', 'off')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'detach-on-destroy', 'off')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, 'history-limit', '50000')
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, '-w', 'pane-border-status', 'top')
    this.tmuxCmd(
      remoteHost,
      'set-option',
      '-t',
      tmuxName,
      '-w',
      'pane-border-format',
      ' #{@ccc-state} • #{session_name} '
    )
  }

  /**
   * Server-wide options that should hold for every CCC session. Idempotent —
   * safe to call on every create. Currently: kill the 500 ms escape-key delay
   * tmux uses to disambiguate Esc from arrow keys (matters for vim/neovim
   * users and anyone who hits Esc a lot).
   */
  private installServerOptions(remoteHost: string | undefined): void {
    this.tmuxCmd(remoteHost, 'set-option', '-g', 'escape-time', '0')
  }

  /**
   * Stream the active pane's output to the unix socket consumed by
   * OutputStream → OscParser. The shell wrapper writes a one-line header
   * naming the session, then `cat`s the pane bytes into `nc -U`. `-O` skips
   * replaying the existing scrollback so we don't get a wall of stale data.
   *
   * Idempotent — calling pipe-pane while an existing pipe is active toggles
   * it off and back on, but tmux re-establishes the pipe on the same
   * connection cleanly.
   */
  enableOutputStreaming(remoteHost: string | undefined, tmuxName: string): void {
    // Remote streaming would require a unix-domain SSH tunnel to forward the
    // remote pipe target back to our local OutputStream socket — out of scope
    // for this iteration. Remote sessions still get OSC parsing via the
    // attached PTY exactly as before.
    if (remoteHost) return
    const cmd = `{ printf 'session:#{session_name}\\n'; cat; } | nc -U '${OUTPUT_SOCKET_PATH}' 2>/dev/null`
    this.tmuxCmd(undefined, 'pipe-pane', '-O', '-t', `=${tmuxName}:`, cmd)
  }

  /** Toggle the pipe-pane off for a session (no-op if it wasn't running). */
  disableOutputStreaming(remoteHost: string | undefined, tmuxName: string): void {
    if (remoteHost) return
    this.tmuxCmd(undefined, 'pipe-pane', '-t', `=${tmuxName}:`)
  }

  /**
   * Re-enable streaming for every CCC-managed session that is currently alive.
   * Called on app start so existing sessions (created in a prior run) get their
   * pipe restored. Walks list-sessions directly to avoid depending on the
   * in-memory cache that may not be hydrated yet.
   */
  enableOutputStreamingForExistingSessions(): void {
    const output = tmux('list-sessions', '-F', '#{session_name}')
    if (!output) return
    for (const name of output.split('\n')) {
      if (name.startsWith(PREFIX) && name !== '__ccc-ctl') {
        this.enableOutputStreaming(undefined, name)
      }
    }
  }

  /**
   * Resolve a tmux session name (e.g. `ccc-foo`) to a tracked session id, for
   * routing OutputStream chunks back into the right OscParser slot. Local-only.
   */
  findIdByLocalTmuxName(tmuxName: string): string | undefined {
    for (const session of this.sessions.values()) {
      if (!session.remoteHost && tmuxSessionName(session.name) === tmuxName) {
        return session.id
      }
    }
    return undefined
  }

  private tmuxCmd(remoteHost: string | undefined, ...args: string[]): string | null {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      return this.sshService.exec(sshHost, tmuxArgsForRemote(...args))
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
      tmuxArgsForRemote('list-sessions', '-F', LIST_FMT)
    )
    if (!output) return []

    const sessions: Session[] = []
    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath, cccState, cccType, cccCwd] = line.split(SEP)
      if (!name?.startsWith(PREFIX)) continue

      const sessionName = name.slice(PREFIX.length)
      const restoredStatus = parseStatus(cccState)
      const restoredType = parseType(cccType)
      // Check if we already track this remote session
      const existing = this.findByTmuxNameAndHost(sessionName, hostName)
      const containerSessions = this.configService?.get().containerSessions ?? {}
      // For container sessions pane_current_path reflects the *host* tmux pane,
      // not the container's interactive shell — prefer the @ccc-cwd we stamped
      // on creation so the sidebar shows /repos/... instead of /home/<user>.
      const containerName = containerSessions[sessionName]
      const effectivePath = containerName ? (cccCwd || existing?.workingDirectory || currentPath) : currentPath
      if (existing) {
        existing.workingDirectory = effectivePath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        if (existing.status === 'error') existing.status = 'idle'
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
        const session: Session = {
          id: generateId(),
          name: sessionName,
          workingDirectory: effectivePath || '~',
          status: restoredStatus ?? 'idle',
          type: restoredType ?? this.configService?.get().sessionTypes[sessionName] ?? 'claude',
          color,
          remoteHost: hostName,
          isContainer: !!containerName,
          containerName,
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
    if (!this.listCacheStale && this.localControl?.isRunning()) {
      return Array.from(this.sessions.values())
        .filter((s) => s.status !== 'stopped')
        .sort((a, b) => a.createdAt - b.createdAt)
    }
    if (this.listInFlight) return this.listInFlight
    const inFlight = this.doList()
    this.listInFlight = inFlight
    try {
      return await inFlight
    } finally {
      this.listInFlight = null
      this.listCacheStale = false
    }
  }

  private async doList(): Promise<Session[]> {
    const output = tmux('list-sessions', '-F', LIST_FMT)
    if (!output) return Array.from(this.sessions.values()).filter((s) => s.status !== 'stopped')

    const tmuxSessions = new Set<string>()

    for (const line of output.split('\n')) {
      const [name, createdStr, currentPath, cccState, cccType, cccCwd] = line.split(SEP)
      if (!name?.startsWith(PREFIX)) continue

      tmuxSessions.add(name)
      const existing = this.findByTmuxName(name)
      const restoredStatus = parseStatus(cccState)
      const restoredType = parseType(cccType)

      const containerSessions = this.configService?.get().containerSessions ?? {}
      const sessionName = name.slice(PREFIX.length)
      const containerName = containerSessions[sessionName]
      // pane_current_path is the host-side tmux pane CWD, which for container
      // sessions sits at $HOME because the docker exec is the foreground
      // process. @ccc-cwd is stamped on creation to preserve the container
      // path; fall back to the existing record only when the option is empty.
      const effectivePath = containerName ? (cccCwd || existing?.workingDirectory || currentPath) : currentPath
      // Skip host-side git probes for container sessions — the path doesn't
      // resolve on the host, so the calls are guaranteed to fail.
      const probeDir = containerName ? null : (effectivePath || '~')
      if (existing) {
        existing.workingDirectory = effectivePath || existing.workingDirectory
        existing.lastActiveAt = Date.now()
        existing.gitBranch = probeDir ? getGitBranch(probeDir) : undefined
        existing.gitDirty = probeDir ? isGitDirty(probeDir) : undefined
        existing.repoPath = probeDir ? getRepoRoot(probeDir) : undefined
        existing.lastNotification = this.notifications.get(existing.id)
        if (existing.status === 'error') existing.status = 'idle'
        if (containerName) {
          existing.isContainer = true
          existing.containerName = containerName
        } else {
          existing.isContainer = false
          existing.containerName = undefined
        }
      } else {
        const created = createdStr ? parseInt(createdStr) * 1000 : Date.now()
        const color = this.getColorForSession(sessionName)
        this.applyTmuxColor(name, color)
        this.configService?.update({ sessionColors: { [sessionName]: color } })
        const session: Session = {
          id: generateId(),
          name: sessionName,
          workingDirectory: effectivePath || '~',
          status: restoredStatus ?? 'idle',
          type: restoredType ?? this.configService?.get().sessionTypes[sessionName] ?? 'claude',
          color,
          isContainer: !!containerName,
          containerName,
          gitBranch: probeDir ? getGitBranch(probeDir) : undefined,
          gitDirty: probeDir ? isGitDirty(probeDir) : undefined,
          repoPath: probeDir ? getRepoRoot(probeDir) : undefined,
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
      if (opts.containerName) {
        this.setUserOption(opts.remoteHost, tmuxName, '@ccc-cwd', opts.workingDirectory)
      }
      this.installServerHooks(opts.remoteHost)
      this.installServerOptions(opts.remoteHost)
      this.installSessionMonitors(opts.remoteHost, tmuxName)
      this.installSessionDefaults(opts.remoteHost, tmuxName)
      this.enableOutputStreaming(opts.remoteHost, tmuxName)

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
      if (opts.containerName) {
        this.setUserOption(undefined, tmuxName, '@ccc-cwd', opts.workingDirectory)
      }
      this.installServerHooks(undefined)
      this.installServerOptions(undefined)
      this.installSessionMonitors(undefined, tmuxName)
      this.installSessionDefaults(undefined, tmuxName)
      this.enableOutputStreaming(undefined, tmuxName)

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

  /**
   * Snapshot recent pane content for sidebar previews of unattached sessions.
   * Returns "" if the session is unknown or capture-pane fails.
   */
  async capturePane(id: string, lines: number = 100): Promise<string> {
    const session = this.sessions.get(id)
    if (!session) return ''
    const tmuxName = tmuxSessionName(session.name)
    const safeLines = Math.max(1, Math.min(lines, 5000))
    // capture-pane is a pane-target command; `=name:` selects the active pane
    // of the exactly-matching session (without the trailing colon, '=' looks
    // for a literal pane name and never matches a session).
    const out = this.tmuxCmd(
      session.remoteHost,
      'capture-pane',
      '-p',
      '-t',
      `=${tmuxName}:`,
      '-S',
      `-${safeLines}`
    )
    return out ?? ''
  }

  private setUserOption(remoteHost: string | undefined, tmuxName: string, key: string, value: string): void {
    this.tmuxCmd(remoteHost, 'set-option', '-t', tmuxName, key, value)
  }

  async kill(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) return

    const tmuxName = tmuxSessionName(session.name)
    this.disableOutputStreaming(session.remoteHost, tmuxName)
    this.tmuxCmd(session.remoteHost, 'kill-session', '-t', `=${tmuxName}`)
    session.status = 'stopped'
    this.sessions.delete(id)

    this.configService?.pruneSessionName(session.name)
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
        this.setUserOption(session.remoteHost, tmuxSessionName(session.name), '@ccc-state', status)
        // Push a status-line redraw so attached clients see the new state
        // immediately. pane-border-format / status-format reference @ccc-state,
        // and tmux only re-renders on its own cadence (status-interval, default
        // 15s) without an explicit refresh.
        this.tmuxCmd(session.remoteHost, 'refresh-client', '-S')
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
