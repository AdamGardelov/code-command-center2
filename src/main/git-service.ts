import { execFileSync } from 'child_process'
import { existsSync, statSync, cpSync, mkdirSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { Worktree, BranchMetadata, CccConfig } from '../shared/types'
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

  getBranchMetadata(repoPath: string, remoteHost?: string): BranchMetadata[] {
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')

    const defaultBranch = this.getDefaultBranch(expanded, remoteHost)

    const worktreeByBranch = new Map<string, Worktree>()
    for (const wt of this.listWorktrees(repoPath, remoteHost)) {
      if (wt.branch && wt.branch !== '(detached)' && wt.branch !== '(bare)') {
        worktreeByBranch.set(wt.branch, wt)
      }
    }

    const sep = '\x1f'
    const format = [
      '%(refname:short)',
      '%(upstream:short)',
      '%(upstream:track)',
      '%(committerdate:unix)',
      '%(authorname)',
      '%(subject)'
    ].join(sep)

    const out = this.exec(
      ['-C', expanded, 'for-each-ref', `--format=${format}`, 'refs/heads'],
      remoteHost
    )
    if (!out) return []

    const now = Math.floor(Date.now() / 1000)
    const thirtyDays = 60 * 60 * 24 * 30
    const results: BranchMetadata[] = []

    for (const line of out.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split(sep)
      const branch = parts[0] ?? ''
      if (!branch) continue
      const upstream = parts[1] ?? ''
      const track = parts[2] ?? ''
      const ts = parseInt(parts[3] ?? '0', 10) || 0
      const author = parts[4] ?? ''
      const subject = parts.slice(5).join(sep)

      let ahead = 0
      let behind = 0
      const aMatch = track.match(/ahead (\d+)/)
      const bMatch = track.match(/behind (\d+)/)
      if (aMatch) ahead = parseInt(aMatch[1], 10)
      if (bMatch) behind = parseInt(bMatch[1], 10)

      const wt = worktreeByBranch.get(branch)
      let dirty = false
      if (wt) {
        const status = this.exec(['-C', wt.path, 'status', '--porcelain'], remoteHost)
        dirty = !!status && status.trim().length > 0
      }

      const stale = behind > 40 || (ts > 0 && now - ts > thirtyDays && behind > 10)

      results.push({
        branch,
        isMain: branch === defaultBranch,
        hasWorktree: wt !== undefined,
        worktreePath: wt?.path,
        dirty,
        ahead,
        behind,
        lastCommitSubject: subject,
        lastCommitAuthor: author,
        lastCommitTimestamp: ts,
        remote: upstream || undefined,
        stale
      })
    }

    results.sort((a, b) => {
      if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
      if (a.hasWorktree !== b.hasWorktree) return a.hasWorktree ? -1 : 1
      return b.lastCommitTimestamp - a.lastCommitTimestamp
    })

    return results
  }

  private getDefaultBranch(repoPath: string, remoteHost?: string): string {
    const headRef = this.exec(
      ['-C', repoPath, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      remoteHost
    )
    if (headRef) return headRef.replace(/^origin\//, '').trim()

    const common = this.exec(
      [
        '-C',
        repoPath,
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads/main',
        'refs/heads/master'
      ],
      remoteHost
    )
    if (common) {
      const first = common.split('\n').find((b) => b.trim())
      if (first) return first.trim()
    }
    return 'main'
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
