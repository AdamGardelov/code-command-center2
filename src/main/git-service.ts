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
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
      return this.sshService.exec(sshHost, `git ${escaped}`)
    }
    try {
      return execFileSync('git', args, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim()
    } catch {
      return null
    }
  }

  private syncPaths(repoPath: string, worktreePath: string, remoteHost?: string): void {
    const paths = this.configService?.get().worktreeSyncPaths ?? []
    if (paths.length === 0) return

    for (const syncPath of paths) {
      if (remoteHost && this.sshService) {
        const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
        const sshHost = hostConfig?.host ?? remoteHost
        this.sshService.exec(sshHost, `test -e '${repoPath}/${syncPath}' && mkdir -p '${worktreePath}/${dirname(syncPath)}' && cp -r '${repoPath}/${syncPath}' '${worktreePath}/${syncPath}'`)
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
    const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    const expandedTarget = remoteHost ? targetPath : targetPath.replace(/^~/, process.env.HOME ?? '')

    // Try existing branch first, fall back to new branch
    let result = this.exec(['-C', expanded, 'worktree', 'add', expandedTarget, branch], remoteHost)
    if (result === null) {
      result = this.exec(['-C', expanded, 'worktree', 'add', '-b', branch, expandedTarget], remoteHost)
    }
    if (result === null) {
      throw new Error(`Failed to create worktree for branch "${branch}" at ${targetPath}`)
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
    return output.split('\n').filter(b => b.length > 0)
  }

  getRepoRoot(dir: string, remoteHost?: string): string | null {
    const expanded = remoteHost ? dir : dir.replace(/^~/, process.env.HOME ?? '')
    return this.exec(['-C', expanded, 'rev-parse', '--show-toplevel'], remoteHost)
  }

  resolveWorktreePath(repoPath: string, branch: string, remoteHost?: string): string {
    const config = this.configService?.get()
    if (!config) return `${repoPath}/../${basename(repoPath)}-worktrees/${branch}`

    const allFavorites = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.favoriteFolders ?? []
      : config.favoriteFolders
    const matchingFav = allFavorites.find(f => {
      const expandedFav = f.path.replace(/^~/, process.env.HOME ?? '')
      const expandedRepo = repoPath.replace(/^~/, process.env.HOME ?? '')
      return expandedFav === expandedRepo || f.path === repoPath
    })
    if (matchingFav?.worktreePath) {
      return `${matchingFav.worktreePath}/${branch}`
    }

    const hostBasePath = remoteHost
      ? config.remoteHosts.find(h => h.name === remoteHost)?.worktreeBasePath
      : undefined
    const basePath = hostBasePath ?? config.worktreeBasePath
    if (basePath) {
      const repoName = basename(repoPath)
      return `${basePath}/${repoName}/${branch}`
    }

    const repoName = basename(repoPath)
    return `${repoPath}/../${repoName}-worktrees/${branch}`
  }
}
