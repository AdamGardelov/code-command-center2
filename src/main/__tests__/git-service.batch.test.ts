import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GitService } from '../git-service'

function makeRepo(parent: string, name: string, opts: { localBranches?: string[]; remoteBranches?: string[] } = {}): string {
  const repoPath = join(parent, name)
  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init', '-b', 'main', repoPath], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'config', 'user.email', 'test@example.com'], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'config', 'user.name', 'Test'], { stdio: 'pipe' })
  writeFileSync(join(repoPath, 'README.md'), '# test\n')
  execFileSync('git', ['-C', repoPath, 'add', '.'], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'commit', '-m', 'init'], { stdio: 'pipe' })
  for (const b of opts.localBranches ?? []) {
    execFileSync('git', ['-C', repoPath, 'branch', b], { stdio: 'pipe' })
  }
  if (opts.remoteBranches && opts.remoteBranches.length > 0) {
    const originPath = join(parent, `${name}.origin.git`)
    execFileSync('git', ['init', '--bare', originPath], { stdio: 'pipe' })
    execFileSync('git', ['-C', repoPath, 'remote', 'add', 'origin', originPath], { stdio: 'pipe' })
    for (const b of opts.remoteBranches) {
      execFileSync('git', ['-C', repoPath, 'branch', b], { stdio: 'pipe' })
      execFileSync('git', ['-C', repoPath, 'push', 'origin', b], { stdio: 'pipe' })
      execFileSync('git', ['-C', repoPath, 'branch', '-D', b], { stdio: 'pipe' })
    }
    execFileSync('git', ['-C', repoPath, 'fetch', 'origin'], { stdio: 'pipe' })
  }
  return repoPath
}

describe('GitService.resolveBranchAcrossRepos', () => {
  let scratch: string
  let svc: GitService

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ccc2-batch-'))
    svc = new GitService()
  })
  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('returns "new-branch" when branch exists nowhere', () => {
    const repo = makeRepo(scratch, 'a')
    const results = svc.resolveBranchAcrossRepos([repo], 'feat/new')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ repoPath: repo, ok: true, mode: 'new-branch' })
  })
})
