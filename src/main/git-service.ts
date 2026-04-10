import { execFileSync } from 'child_process'
import { existsSync, statSync, cpSync, mkdirSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { Worktree, CccConfig } from '../shared/types'
import type { SshService } from './ssh-service'

export class GitService {
  private sshService: SshService | null = null
  private configService: { get(): CccConfig } | null = null

  setSshService(service: SshService): void {
    this.sshService = service
  }

  setConfigService(service: { get(): CccConfig }): void {
    this.configService = service
  }

  private exec(args: string[], remoteHost?: string): string | null {
    return this.execDetailed(args, remoteHost).stdout
  }

  private execDetailed(args: string[], remoteHost?: string): { stdout: string | null; stderr: string } {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
      const stdout = this.sshService.exec(sshHost, `git ${escaped}`)
      return { stdout, stderr: stdout === null ? 'remote git command failed' : '' }
    }
    try {
      const stdout = execFileSync('git', args, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
      return { stdout, stderr: '' }
    } catch (err) {
      const e = err as { stderr?: Buffer | string; message?: string }
      const stderr = (e.stderr ? e.stderr.toString() : e.message ?? 'unknown error').trim()
      return { stdout: null, stderr }
    }
  }

  private syncPaths(repoPath: string, worktreePath: string, remoteHost?: string): void {
    const paths = this.configService?.get().worktreeSyncPaths ?? []
    if (paths.length === 0) return

    const esc = (s: string): string => s.replace(/'/g, "'\\''")

    for (const syncPath of paths) {
      if (remoteHost && this.sshService) {
        const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
        const sshHost = hostConfig?.host ?? remoteHost
        const src = `'${esc(repoPath)}/${esc(syncPath)}'`
        const dest = `'${esc(worktreePath)}/${esc(syncPath)}'`
        const destDir = `'${esc(worktreePath)}/${esc(dirname(syncPath))}'`
        const result = this.sshService.exec(sshHost, `test -e ${src} && mkdir -p ${destDir} && cp -r ${src} ${dest}`)
        if (result === null) {
          console.warn(`Failed to sync ${syncPath} to remote worktree`)
        }
        continue
      }

      const src = join(repoPath, syncPath)
      const dest = join(worktreePath, syncPath)
      try {
        if (!existsSync(src)) continue
        mkdirSync(dirname(dest), { recursive: true })
        cpSync(src, dest, { recursive: statSync(src).isDirectory() })
      } catch (err) {
        console.warn(`Failed to sync ${syncPath} to worktree:`, err)
      }
    }
  }

  listWorktrees(repoPath: string, remoteHost?: string): Worktree[] {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const output = this.exec(['-C', expanded, 'worktree', 'list', '--porcelain'], remoteHost)
    if (!output) return []

    const worktrees: Worktree[] = []
    let current: Partial<Worktree> = {}

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as Worktree)
        current = { path: line.slice(9), isMain: false, repoPath: expanded }
      } else if (line.startsWith('branch refs/heads/')) {
        current.branch = line.slice(18)
      } else if (line === 'bare') {
        current.branch = '(bare)'
      } else if (line.startsWith('HEAD ')) {
        if (!current.branch) current.branch = '(detached)'
      } else if (line === '') {
        if (current.path && worktrees.length === 0 && Object.keys(current).length > 1) {
          current.isMain = true
        }
      }
    }
    if (current.path) {
      if (worktrees.length === 0) current.isMain = true
      worktrees.push(current as Worktree)
    }

    return worktrees
  }

  addWorktree(repoPath: string, branch: string, targetPath: string, remoteHost?: string): Worktree {
    // Strip ref prefixes users may paste or pick from branch lists
    branch = branch.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^heads\//, '')
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const expandedTarget = remoteHost ? targetPath : targetPath.replace(/^~/, process.env.HOME ?? '')

    // Ensure parent directory exists — git worktree add requires it
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      const parent = dirname(expandedTarget).replace(/'/g, "'\\''")
      this.sshService.exec(sshHost, `mkdir -p '${parent}'`)
    } else {
      try {
        mkdirSync(dirname(expandedTarget), { recursive: true })
      } catch (err) {
        console.warn('Failed to create worktree parent dir:', err)
      }
    }

    // Try existing branch first, fall back to new branch
    const existing = this.execDetailed(['-C', expanded, 'worktree', 'add', expandedTarget, branch], remoteHost)
    let result: string | null = existing.stdout
    let lastStderr = existing.stderr
    if (result === null) {
      const created = this.execDetailed(['-C', expanded, 'worktree', 'add', '-b', branch, expandedTarget], remoteHost)
      result = created.stdout
      if (result === null) lastStderr = created.stderr || lastStderr
    }
    if (result === null) {
      throw new Error(`Failed to create worktree for branch "${branch}" at ${expandedTarget}: ${lastStderr}`)
    }

    this.syncPaths(expanded, expandedTarget, remoteHost)

    return {
      path: expandedTarget,
      branch,
      isMain: false,
      repoPath: expanded
    }
  }

  removeWorktree(worktreePath: string, remoteHost?: string): void {
    const expanded = remoteHost ? worktreePath : worktreePath.replace(/^~/, process.env.HOME ?? '')
    // Resolve repo root from the worktree path so git knows which repo to operate on
    const repoRoot = this.getRepoRoot(expanded, remoteHost)
    if (!repoRoot) return
    const result = this.exec(['-C', repoRoot, 'worktree', 'remove', expanded], remoteHost)
    if (result === null) {
      this.exec(['-C', repoRoot, 'worktree', 'remove', '--force', expanded], remoteHost)
    }
  }

  getBranch(dir: string, remoteHost?: string): string | null {
    const expanded = remoteHost ? dir : dir.replace(/^~/, process.env.HOME ?? '')
    const result = this.exec(['-C', expanded, 'rev-parse', '--abbrev-ref', 'HEAD'], remoteHost)
    return result || null
  }

  listBranches(repoPath: string, remoteHost?: string): string[] {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const output = this.exec(['-C', expanded, 'branch', '-a', '--format=%(refname:short)'], remoteHost)
    if (!output) return []
    const cleaned = new Set<string>()
    for (const raw of output.split('\n')) {
      let b = raw.trim()
      if (!b || b.includes(' -> ')) continue
      // Strip any ref/heads/remotes prefixes and the first remote segment (e.g. "origin/")
      b = b.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^heads\//, '')
      if (b.startsWith('remotes/')) b = b.slice('remotes/'.length)
      cleaned.add(b)
    }
    return [...cleaned].sort()
  }

  getRepoRoot(dir: string, remoteHost?: string): string | null {
    const expanded = remoteHost ? dir : dir.replace(/^~/, process.env.HOME ?? '')
    return this.exec(['-C', expanded, 'rev-parse', '--show-toplevel'], remoteHost)
  }

  resolveWorktreePath(repoPath: string, branch: string, remoteHost?: string): string {
    // Use the leaf segment of the branch name as the folder, stripping ref/remote prefixes
    const cleanBranch = branch
      .replace(/^refs\/heads\//, '')
      .replace(/^refs\/remotes\//, '')
      .replace(/^heads\//, '')
    const folder = basename(cleanBranch) || cleanBranch

    const config = this.configService?.get()
    if (!config) return `${repoPath}/../${basename(repoPath)}-worktrees/${folder}`

    const allFavorites = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.favoriteFolders ?? []
      : config.favoriteFolders
    const matchingFav = allFavorites.find(f => {
      const expandedFav = f.path.replace(/^~/, process.env.HOME ?? '')
      const expandedRepo = repoPath.replace(/^~/, process.env.HOME ?? '')
      return expandedFav === expandedRepo || f.path === repoPath
    })
    if (matchingFav?.worktreePath) {
      const repoName = basename(repoPath)
      return `${matchingFav.worktreePath}/${folder}/${repoName}`
    }

    const hostBasePath = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.worktreeBasePath
      : undefined
    const basePath = hostBasePath ?? config.worktreeBasePath
    if (basePath) {
      const repoName = basename(repoPath)
      return `${basePath}/${folder}/${repoName}`
    }

    const repoName = basename(repoPath)
    return `${repoPath}/../${repoName}-worktrees/${folder}`
  }
}
