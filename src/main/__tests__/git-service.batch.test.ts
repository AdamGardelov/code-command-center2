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

  it('returns "existing-local" when branch exists locally', () => {
    const repo = makeRepo(scratch, 'a', { localBranches: ['feat/x'] })
    const results = svc.resolveBranchAcrossRepos([repo], 'feat/x')
    expect(results[0]).toMatchObject({ repoPath: repo, ok: true, mode: 'existing-local' })
  })

  it('returns "track-remote" when branch exists only on origin', () => {
    const repo = makeRepo(scratch, 'a', { remoteBranches: ['feat/y'] })
    const results = svc.resolveBranchAcrossRepos([repo], 'feat/y')
    expect(results[0]).toMatchObject({ repoPath: repo, ok: true, mode: 'track-remote' })
  })

  it('handles mixed states across repos in one call', () => {
    const repoA = makeRepo(scratch, 'a', { localBranches: ['feat/z'] })
    const repoB = makeRepo(scratch, 'b')
    const repoC = makeRepo(scratch, 'c', { remoteBranches: ['feat/z'] })
    const results = svc.resolveBranchAcrossRepos([repoA, repoB, repoC], 'feat/z')
    expect(results).toHaveLength(3)
    expect(results.find((r) => r.repoPath === repoA)).toMatchObject({ mode: 'existing-local' })
    expect(results.find((r) => r.repoPath === repoB)).toMatchObject({ mode: 'new-branch' })
    expect(results.find((r) => r.repoPath === repoC)).toMatchObject({ mode: 'track-remote' })
  })
})

describe('GitService.addWorktreeBatch', () => {
  let scratch: string
  let svc: GitService

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ccc2-batch-'))
    svc = new GitService()
  })
  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('creates worktrees for all repos when all succeed', () => {
    const repoA = makeRepo(scratch, 'a')
    const repoB = makeRepo(scratch, 'b')
    const out = join(scratch, 'wt')
    const results = svc.addWorktreeBatch({
      repos: [
        { repoPath: repoA, mode: 'new-branch' },
        { repoPath: repoB, mode: 'new-branch' },
      ],
      branch: 'feat/x',
    }, (repoPath) => `${out}/feat-x/${repoPath.split('/').pop()}`)

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('returns per-repo errors without aborting other repos', () => {
    const repoA = makeRepo(scratch, 'a')
    const out = join(scratch, 'wt')
    const results = svc.addWorktreeBatch({
      repos: [
        { repoPath: repoA, mode: 'new-branch' },
        { repoPath: '/nonexistent/repo/path', mode: 'new-branch' },
      ],
      branch: 'feat/x',
    }, (repoPath) => `${out}/feat-x/${repoPath.split('/').pop()}`)

    expect(results).toHaveLength(2)
    expect(results.find((r) => r.repoPath === repoA)?.ok).toBe(true)
    expect(results.find((r) => r.repoPath === '/nonexistent/repo/path')?.ok).toBe(false)
  })
})

describe('GitService.resolveWorktreePath', () => {
  let scratch: string
  let base: string
  let svc: GitService

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ccc2-resolve-'))
    base = join(scratch, 'wt')
    svc = new GitService()
    // Minimal config: just a base path. No favorites, no remote hosts.
    svc.setConfigService({
      get: () => ({
        worktreeBasePath: base,
        worktreeSyncPaths: [],
        favoriteFolders: [],
        remoteHosts: [],
        // The rest of CccConfig isn't used by resolveWorktreePath; the unsafe
        // cast keeps the test focused on the fields under exercise.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    })
  })
  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('uses the leaf of the branch as folder when no taskName is given', () => {
    const repo = join(scratch, 'Wint.Salary')
    const path = svc.resolveWorktreePath(repo, 'feat/refund-flow')
    expect(path).toBe(`${base}/refund-flow/Wint.Salary`)
  })

  it('uses taskName as folder when provided, ignoring the branch slug', () => {
    const repo = join(scratch, 'Wint.Salary')
    const path = svc.resolveWorktreePath(repo, 'feat/refund-flow', undefined, undefined, 'feat-refund-flow')
    expect(path).toBe(`${base}/feat-refund-flow/Wint.Salary`)
  })

  it('falls back to branch leaf when taskName is whitespace-only', () => {
    const repo = join(scratch, 'Core')
    const path = svc.resolveWorktreePath(repo, 'feat/x', undefined, undefined, '   ')
    expect(path).toBe(`${base}/x/Core`)
  })

  it('groups two repos under the same task folder when batched with taskName', () => {
    const repoA = makeRepo(scratch, 'a')
    const repoB = makeRepo(scratch, 'b')
    const results = svc.addWorktreeBatch(
      {
        repos: [
          { repoPath: repoA, mode: 'new-branch' },
          { repoPath: repoB, mode: 'new-branch' },
        ],
        branch: 'feat/refund-flow',
        taskName: 'feat-refund-flow',
      },
      (repoPath) =>
        svc.resolveWorktreePath(repoPath, 'feat/refund-flow', undefined, undefined, 'feat-refund-flow'),
    )

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
    const okA = results.find((r) => r.repoPath === repoA)
    const okB = results.find((r) => r.repoPath === repoB)
    if (okA?.ok) expect(okA.worktree.path).toBe(`${base}/feat-refund-flow/a`)
    if (okB?.ok) expect(okB.worktree.path).toBe(`${base}/feat-refund-flow/b`)
  })
})
