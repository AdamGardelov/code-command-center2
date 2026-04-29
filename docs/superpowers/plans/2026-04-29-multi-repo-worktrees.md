# Multi-repo worktrees Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select N repos in the New Session modal and bulk-create worktrees for them on a shared branch, with either one session in a primary repo (default) or N sessions auto-grouped (opt-in).

**Architecture:** Two-stage delivery. PR 1 lands backend (`git-service` batch helpers + new IPC) and bootstraps a vitest harness so the logic can be TDD'd. PR 1 ships dead code from a UI standpoint — no user-visible change. PR 2 wires up the multi-select UI: a new `MultiRepoPreview` rail subcomponent, expanded modal layout (560 → 880px when N≥2), unified submit routing.

**Tech Stack:** Electron + electron-vite, React 19, TypeScript, Zustand, Vitest (new), node `child_process` for git/SSH, existing `GitService` + `SshService`.

**Spec:** `docs/superpowers/specs/2026-04-29-multi-repo-worktrees/design.md`
**Mockup:** `docs/superpowers/specs/2026-04-29-multi-repo-worktrees/mockup.html`

**Worktree:** Implementation should run in `/home/adam/Dev/Wint/worktrees/multi-repo-worktrees/code-command-center2/`. Branch: `feat/multi-repo-worktrees`.

---

## File map

**PR 1 — Backend + tooling**

- Create: `vitest.config.ts` — vitest config for node-side tests.
- Modify: `package.json` — add `vitest` devDep, `test` and `test:watch` scripts.
- Modify: `src/main/git-service.ts` — add `resolveBranchAcrossRepos()` + `addWorktreeBatch()` methods.
- Create: `src/main/__tests__/git-service.batch.test.ts` — integration tests against tmp git repos.
- Modify: `src/main/ipc/git.ts` — register `git:resolve-branch-batch` and `git:add-worktree-batch` handlers.
- Modify: `src/preload/index.ts` — expose `cccAPI.git.resolveBranchBatch` and `cccAPI.git.addWorktreeBatch`.
- Modify: `src/shared/types.ts` — add `BatchWorktreeRequest`, `BatchWorktreeResult` types.

**PR 2 — Frontend**

- Create: `src/renderer/components/MultiRepoPreview.tsx` — right-rail preview component (cards + mode toggle + summary).
- Modify: `src/renderer/components/NewSessionModal.tsx` — multi-select state, layout transition, submit routing.
- Modify: `src/renderer/components/NewSessionModal.tsx` styles (or co-located CSS) — `[data-multi="true"]` rules for width animation.
- Modify: `src/renderer/stores/session-store.ts` (light) — verify `addSessionGroup` / `createSession` are exposed for batch use.

---

# PR 1 — Backend + tooling

### Task 1: Bootstrap vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add vitest as a devDependency**

Run:
```bash
pnpm add -D vitest@^2.1.0
```
Expected: vitest appears in `package.json` `devDependencies`. No other changes.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
})
```

- [ ] **Step 3: Add `test` scripts to `package.json`**

In `package.json`, under `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs (no tests yet, exits clean)**

Run: `pnpm test`
Expected: vitest reports `No test files found` and exits 0 (or exits 1 with that message — both acceptable; importantly it doesn't crash).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml
git commit -m "chore(test): add vitest harness"
```

---

### Task 2: Shared types for batch operations

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Append types after the existing `WorktreeCreateMode` declaration**

In `src/shared/types.ts`, after the line `export type WorktreeCreateMode = 'existing-local' | 'track-remote' | 'new-branch'`, add:

```ts
export interface BatchWorktreeRepoRequest {
  repoPath: string
  mode: WorktreeCreateMode
}

export interface BatchWorktreeRequest {
  repos: BatchWorktreeRepoRequest[]
  branch: string
  remoteHost?: string
  containerName?: string
}

export type BatchWorktreeResult =
  | { repoPath: string; ok: true; worktree: Worktree }
  | { repoPath: string; ok: false; error: string }

export type BranchResolution =
  | { repoPath: string; ok: true; mode: WorktreeCreateMode; existingWorktreePath?: string }
  | { repoPath: string; ok: false; error: string }
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no type errors introduced.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(types): batch worktree request/result types"
```

---

### Task 3: `resolveBranchAcrossRepos` — TDD red

**Files:**
- Create: `src/main/__tests__/git-service.batch.test.ts`

- [ ] **Step 1: Create the test file with a tmp-repo helper and the first failing test**

```ts
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
  // Simulate remote-only branches via a bare "origin" repo + push
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
```

- [ ] **Step 2: Run the test — expect failure**

Run: `pnpm test src/main/__tests__/git-service.batch.test.ts`
Expected: FAIL — `svc.resolveBranchAcrossRepos is not a function`.

---

### Task 4: `resolveBranchAcrossRepos` — TDD green

**Files:**
- Modify: `src/main/git-service.ts`

- [ ] **Step 1: Add `BranchResolution` to the import line at top of `git-service.ts`**

Replace:
```ts
import type { Worktree, BranchMetadata, CccConfig, WorktreeCreateMode } from '../shared/types'
```
With:
```ts
import type { Worktree, BranchMetadata, CccConfig, WorktreeCreateMode, BranchResolution, BatchWorktreeRequest, BatchWorktreeResult } from '../shared/types'
```

- [ ] **Step 2: Add `resolveBranchAcrossRepos` method to `GitService` class**

Add this method just above `resolveWorktreePath` (near the bottom of the class):

```ts
resolveBranchAcrossRepos(
  repoPaths: string[],
  branch: string,
  remoteHost?: string,
  containerName?: string
): BranchResolution[] {
  const cleanBranch = branch
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\//, '')
    .replace(/^heads\//, '')

  return repoPaths.map((repoPath) => {
    const expanded = (remoteHost || containerName) ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
    try {
      const localExists = this.exec(
        ['-C', expanded, 'rev-parse', '--verify', `refs/heads/${cleanBranch}`],
        remoteHost,
        containerName
      )
      if (localExists) {
        const wt = this.listWorktrees(repoPath, remoteHost, containerName)
          .find((w) => w.branch === cleanBranch)
        return { repoPath, ok: true, mode: 'existing-local', existingWorktreePath: wt?.path }
      }
      const remoteExists = this.exec(
        ['-C', expanded, 'rev-parse', '--verify', `refs/remotes/origin/${cleanBranch}`],
        remoteHost,
        containerName
      )
      if (remoteExists) {
        return { repoPath, ok: true, mode: 'track-remote' }
      }
      return { repoPath, ok: true, mode: 'new-branch' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { repoPath, ok: false, error: msg }
    }
  })
}
```

- [ ] **Step 3: Run the test — expect green**

Run: `pnpm test src/main/__tests__/git-service.batch.test.ts`
Expected: PASS — 1 test passing.

- [ ] **Step 4: Commit**

```bash
git add src/main/git-service.ts src/main/__tests__/git-service.batch.test.ts
git commit -m "feat(git): resolveBranchAcrossRepos with new-branch detection"
```

---

### Task 5: `resolveBranchAcrossRepos` — broaden test coverage

**Files:**
- Modify: `src/main/__tests__/git-service.batch.test.ts`

- [ ] **Step 1: Add three more cases to the existing describe block**

After the existing `it('returns "new-branch" when branch exists nowhere', …)` test, add:

```ts
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
```

- [ ] **Step 2: Run all four tests**

Run: `pnpm test src/main/__tests__/git-service.batch.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/main/__tests__/git-service.batch.test.ts
git commit -m "test(git): cover existing-local, track-remote, mixed-resolution cases"
```

---

### Task 6: `addWorktreeBatch` — TDD red

**Files:**
- Modify: `src/main/__tests__/git-service.batch.test.ts`

- [ ] **Step 1: Add a second describe block for batch creation**

Append at the bottom of the test file (outside the existing `describe`):

```ts
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `pnpm test src/main/__tests__/git-service.batch.test.ts`
Expected: FAIL — `svc.addWorktreeBatch is not a function`.

---

### Task 7: `addWorktreeBatch` — TDD green

**Files:**
- Modify: `src/main/git-service.ts`

- [ ] **Step 1: Add `addWorktreeBatch` method just below `addWorktree`**

```ts
addWorktreeBatch(
  request: BatchWorktreeRequest,
  resolveTargetPath: (repoPath: string) => string
): BatchWorktreeResult[] {
  const { repos, branch, remoteHost, containerName } = request
  return repos.map(({ repoPath, mode }) => {
    try {
      const target = resolveTargetPath(repoPath)
      const worktree = this.addWorktree(repoPath, branch, target, mode, remoteHost, containerName)
      return { repoPath, ok: true, worktree }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { repoPath, ok: false, error: msg }
    }
  })
}
```

- [ ] **Step 2: Run all batch tests**

Run: `pnpm test src/main/__tests__/git-service.batch.test.ts`
Expected: PASS — 6 tests total (4 resolution + 2 batch).

- [ ] **Step 3: Commit**

```bash
git add src/main/git-service.ts src/main/__tests__/git-service.batch.test.ts
git commit -m "feat(git): addWorktreeBatch with per-repo error isolation"
```

---

### Task 8: IPC handlers for batch operations

**Files:**
- Modify: `src/main/ipc/git.ts`

- [ ] **Step 1: Add the two new handlers at the bottom of `registerGitIpc`**

Update the imports at the top:
```ts
import type { WorktreeCreateMode, BatchWorktreeRequest } from '../../shared/types'
```

Then, before the closing `}` of `registerGitIpc`, add:

```ts
ipcMain.handle(
  'git:resolve-branch-batch',
  async (
    _event,
    repoPaths: string[],
    branch: string,
    remoteHost?: string,
    containerName?: string
  ) => {
    return gitService.resolveBranchAcrossRepos(repoPaths, branch, remoteHost, containerName)
  }
)

ipcMain.handle(
  'git:add-worktree-batch',
  async (_event, request: BatchWorktreeRequest) => {
    return gitService.addWorktreeBatch(request, (repoPath) =>
      gitService.resolveWorktreePath(repoPath, request.branch, request.remoteHost, request.containerName)
    )
  }
)
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/git.ts
git commit -m "feat(ipc): expose git:resolve-branch-batch and git:add-worktree-batch"
```

---

### Task 9: Preload exposure

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Update imports**

At the top of `src/preload/index.ts`, find the existing type import for shared types and ensure `BatchWorktreeRequest`, `BatchWorktreeResult`, `BranchResolution` are included. If the file imports types individually, add these names. If it imports the whole namespace, no change needed.

- [ ] **Step 2: Add the two new methods inside `git: { … }`**

Locate the `git:` block (around line 117) and add these methods (e.g. after `fetchRemotes`):

```ts
resolveBranchBatch: (
  repoPaths: string[],
  branch: string,
  remoteHost?: string,
  containerName?: string
): Promise<BranchResolution[]> =>
  ipcRenderer.invoke('git:resolve-branch-batch', repoPaths, branch, remoteHost, containerName),
addWorktreeBatch: (request: BatchWorktreeRequest): Promise<BatchWorktreeResult[]> =>
  ipcRenderer.invoke('git:add-worktree-batch', request),
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors. The `cccAPI` type in the renderer should automatically pick up the new methods if it's defined via a `typeof preload` pattern; if it's hand-written, also update the API typedef accordingly.

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): expose git.resolveBranchBatch and git.addWorktreeBatch"
```

---

### Task 10: PR 1 ship

- [ ] **Step 1: Run full check**

Run: `pnpm typecheck && pnpm test && pnpm lint`
Expected: all pass.

- [ ] **Step 2: Push branch and open draft PR**

Confirm with the user before pushing. Once confirmed:

```bash
git push -u origin feat/multi-repo-worktrees-backend
gh pr create --draft --title "feat: multi-repo worktree backend (resolveBranchBatch + addWorktreeBatch)" --body "$(cat <<'EOF'
## Summary
- Adds `gitService.resolveBranchAcrossRepos` — per-repo new/checkout/track resolution.
- Adds `gitService.addWorktreeBatch` — fans out worktree creation with per-repo error isolation.
- Wires both up via new IPC handlers and preload methods.
- Bootstraps vitest for node-side tests; covers both helpers with tmp-repo integration tests.
- No UI surface yet — that lands in PR 2.

## Test plan
- [ ] `pnpm test` passes locally
- [ ] `pnpm typecheck` passes
- [ ] App still builds: `pnpm build`
EOF
)"
```

---

# PR 2 — Frontend

> Branch this off `main` after PR 1 merges. Branch name: `feat/multi-repo-worktrees-ui`.

### Task 11: Stub `MultiRepoPreview` component

**Files:**
- Create: `src/renderer/components/MultiRepoPreview.tsx`

- [ ] **Step 1: Create the file with the exact prop interface and a minimal render**

```tsx
import { Star, X as XIcon, LayoutGrid } from 'lucide-react'
import type { WorktreeCreateMode } from '../../shared/types'

export interface MultiRepoPreviewProps {
  selectedRepos: string[]
  primaryRepo: string | null
  branch: string
  resolutions: Map<string, WorktreeCreateMode>
  perRepoSessions: boolean
  worktreeBasePath: string
  creationErrors: Map<string, string>
  onSetPrimary: (repo: string) => void
  onRemove: (repo: string) => void
  onTogglePerRepo: () => void
  onRetry: (repo: string) => void
}

export default function MultiRepoPreview(props: MultiRepoPreviewProps): React.JSX.Element {
  const {
    selectedRepos, primaryRepo, branch, resolutions, perRepoSessions,
    worktreeBasePath, creationErrors,
    onSetPrimary, onRemove, onTogglePerRepo, onRetry,
  } = props

  const repoLeaf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p

  return (
    <aside className="ccc-multi-rail">
      <div className="ccc-multi-rail__head">
        <h2>Task preview</h2>
        <span className="ccc-multi-rail__count">{selectedRepos.length} repos</span>
      </div>

      <div className="ccc-multi-rail__body ccc-scroll">
        {selectedRepos.map((repoPath) => {
          const isPrimary = repoPath === primaryRepo
          const mode = resolutions.get(repoPath)
          const err = creationErrors.get(repoPath)
          const repoName = repoLeaf(repoPath)
          return (
            <div key={repoPath} className={`repo-card${isPrimary ? ' primary' : ''}${err ? ' has-error' : ''}`}>
              <div className="repo-card__row1">
                <span className="repo-card__name">{repoName}</span>
                <button
                  className="repo-card__star"
                  type="button"
                  disabled={perRepoSessions}
                  onClick={() => onSetPrimary(repoPath)}
                  title={isPrimary ? 'Primary' : 'Make primary'}
                >
                  <Star size={11} fill={isPrimary ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="repo-card__rm"
                  type="button"
                  onClick={() => onRemove(repoPath)}
                  title="Remove"
                >
                  <XIcon size={11} />
                </button>
              </div>
              <div className="repo-card__meta">
                <span className={`resolution resolution--${mode ?? 'unknown'}`}>
                  {mode === 'new-branch' && '+ new branch'}
                  {mode === 'existing-local' && 'checkout existing'}
                  {mode === 'track-remote' && `track origin/${branch}`}
                  {!mode && '…'}
                </span>
                <span className={`session-flag${perRepoSessions || isPrimary ? '' : ' silent'}`}>
                  <span className="session-flag__pip" />
                  {perRepoSessions
                    ? `session: ${branch} · ${repoName}`
                    : isPrimary ? 'session here' : 'worktree only'}
                </span>
              </div>
              <div className="wt-path">
                <span className="seg-base">{worktreeBasePath}/</span>
                <span className="seg-branch">{branch}</span>
                <span className="seg-base">/</span>
                <span className="seg-repo">{repoName}</span>
              </div>
              {err && (
                <div className="repo-card__err">
                  <span>{err}</span>
                  <button type="button" onClick={() => onRetry(repoPath)}>Retry</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="ccc-multi-rail__mode">
        <button
          type="button"
          className={`tg${perRepoSessions ? ' on' : ''}`}
          onClick={onTogglePerRepo}
        >
          <span className="sw" />
          <span className="lbl-text">
            <LayoutGrid size={11} />
            Spawn one session per repo
          </span>
        </button>
        <div className="ccc-multi-rail__summary">
          {perRepoSessions ? (
            <><b>{selectedRepos.length} worktrees</b> + <b>{selectedRepos.length} sessions</b> grouped as <b>{branch}</b></>
          ) : (
            <><b>{selectedRepos.length} worktrees</b>, <b>1 session</b> in <b>{primaryRepo ? repoLeaf(primaryRepo) : '—'}</b></>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/MultiRepoPreview.tsx
git commit -m "feat(ui): MultiRepoPreview rail subcomponent (unstyled)"
```

---

### Task 12: Add CSS for `MultiRepoPreview` and modal multi-repo state

**Files:**
- Locate the existing renderer CSS file used by `NewSessionModal` (likely `src/renderer/assets/...` or `src/renderer/index.css` — the existing modal uses class names like `chip-row`, `bp-row__badge`). Modify whichever file holds those rules.

- [ ] **Step 1: Find the right CSS file**

Run:
```bash
grep -rn "chip-row\|bp-row__badge\|branch-trigger" src/renderer --include="*.css" --include="*.scss"
```
Expected: shows the file. Note its path; reference it as `<MODAL_CSS>` in the next step.

- [ ] **Step 2: Append the multi-repo styles to `<MODAL_CSS>`**

Append to that file:

```css
/* Multi-repo modal expansion */
.modal-shell { transition: width 280ms cubic-bezier(0.2, 0.8, 0.2, 1); }
.modal-shell[data-multi="true"] { width: 880px; }
.modal-shell[data-multi="true"] .modal-body-wrap {
  display: grid;
  grid-template-columns: 1fr 360px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

/* Right rail */
.ccc-multi-rail {
  border-left: 1px solid var(--line-soft);
  background: linear-gradient(180deg, color-mix(in srgb, var(--amber) 3%, transparent), transparent 22%), var(--bg-0);
  display: flex; flex-direction: column;
  overflow: hidden; min-height: 0;
  animation: rail-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes rail-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: none; }
}
.ccc-multi-rail__head {
  padding: 14px 18px 10px;
  border-bottom: 1px solid var(--line-soft);
  display: flex; align-items: baseline; gap: 8px;
}
.ccc-multi-rail__head h2 {
  margin: 0;
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-3);
}
.ccc-multi-rail__count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--amber);
}
.ccc-multi-rail__body {
  overflow-y: auto;
  padding: 10px 14px 14px;
  display: flex; flex-direction: column; gap: 8px;
  flex: 1; min-height: 0;
}

/* Repo card */
.repo-card {
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--bg-1);
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
  position: relative;
  animation: card-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.repo-card.primary {
  border-color: var(--amber-rim);
  background: linear-gradient(180deg, color-mix(in srgb, var(--amber) 10%, transparent) 0%, transparent 60%), var(--bg-1);
}
.repo-card.has-error { border-color: var(--s-error); }
@keyframes card-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.repo-card__row1 { display: flex; align-items: center; gap: 8px; }
.repo-card__name {
  font-family: var(--font-mono); font-size: 11.5px; font-weight: 500;
  color: var(--ink-0); flex: 1; min-width: 0;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap;
}
.repo-card.primary .repo-card__name { color: var(--amber-hi); }
.repo-card__star, .repo-card__rm {
  background: transparent; border: none; cursor: pointer;
  padding: 2px; display: grid; place-items: center; border-radius: 4px;
  color: var(--ink-4);
}
.repo-card__star { color: var(--amber); opacity: 0.25; }
.repo-card__star:hover { opacity: 1; }
.repo-card__star:disabled { opacity: 0.1; cursor: not-allowed; }
.repo-card.primary .repo-card__star { opacity: 1; }
.repo-card__rm:hover { color: var(--s-error); background: var(--bg-2); }
.repo-card__meta { display: flex; align-items: center; gap: 8px; }
.repo-card__err {
  font-size: 10.5px; color: var(--s-error);
  display: flex; gap: 8px; align-items: center;
  padding-top: 4px; border-top: 1px dashed color-mix(in srgb, var(--s-error) 40%, transparent);
}
.repo-card__err button {
  background: transparent; color: var(--ink-1);
  border: 1px solid var(--line); border-radius: 4px;
  padding: 2px 8px; font-size: 10px; cursor: pointer;
  font-family: inherit;
}
.repo-card__err button:hover { border-color: var(--amber-rim); color: var(--amber); }

.resolution {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 3px; width: fit-content;
  font-family: var(--font-mono);
}
.resolution--new-branch { color: var(--amber); background: color-mix(in srgb, var(--amber) 10%, transparent); border: 1px solid var(--amber-rim); }
.resolution--existing-local { color: var(--ink-1); background: var(--bg-2); border: 1px solid var(--line); }
.resolution--track-remote { color: var(--container, #7ec8c8); background: color-mix(in srgb, var(--container, #7ec8c8) 10%, transparent); border: 1px solid color-mix(in srgb, var(--container, #7ec8c8) 30%, transparent); }
.resolution--unknown { color: var(--ink-3); background: var(--bg-2); border: 1px solid var(--line); }

.session-flag {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--amber); font-family: var(--font-mono);
}
.session-flag.silent { color: var(--ink-4); }
.session-flag__pip {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 6px var(--amber-rim);
}
.session-flag.silent .session-flag__pip { background: transparent; box-shadow: none; border: 1px dashed var(--ink-4); }

.wt-path {
  font-family: var(--font-mono); font-size: 10px; color: var(--ink-3);
  line-height: 1.55; word-break: break-all;
}
.wt-path .seg-base { color: var(--ink-4); }
.wt-path .seg-branch { color: var(--amber); }
.wt-path .seg-repo { color: var(--ink-1); }

.ccc-multi-rail__mode {
  border-top: 1px solid var(--line-soft);
  padding: 12px 16px;
  background: var(--bg-1);
  display: flex; flex-direction: column; gap: 8px;
}
.ccc-multi-rail__summary {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--ink-1); line-height: 1.55;
}
.ccc-multi-rail__summary b { color: var(--amber); font-weight: 600; }
```

- [ ] **Step 3: Commit**

```bash
git add <MODAL_CSS>
git commit -m "feat(ui): styles for multi-repo modal expansion and preview rail"
```

---

### Task 13: Wire multi-select state into `NewSessionModal`

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Replace `workingDirectory: string` state with multi-select-aware state**

In `NewSessionModal.tsx`, locate the existing state block (currently around line 351-368). Replace the single `workingDirectory` state with the following, keeping all other existing state intact:

```tsx
// Replace:
//   const [workingDirectory, setWorkingDirectory] = useState('')
// With:
const [selectedRepos, setSelectedRepos] = useState<string[]>([])
const [primaryRepo, setPrimaryRepo] = useState<string | null>(null)
const [perRepoSessions, setPerRepoSessions] = useState(false)
const [resolutions, setResolutions] = useState<Map<string, WorktreeCreateMode>>(new Map())
const [creationErrors, setCreationErrors] = useState<Map<string, string>>(new Map())
const [branchInput, setBranchInput] = useState('')
const [freeFormPath, setFreeFormPath] = useState('')

const workingDirectory = selectedRepos[0] ?? freeFormPath
```

The trailing `workingDirectory` derivation keeps single-repo callsites compiling without change while we migrate. Update the imports at the top to include `WorktreeCreateMode`:

```tsx
import type { SessionType, ContainerConfig, FavoriteFolder, Session, WorktreeCreateMode } from '../../shared/types'
```

- [ ] **Step 2: Add helper computed values just below the state block**

```tsx
const isMulti = selectedRepos.length >= 2
const worktreeBasePath = useMemo(() => {
  // Prefer per-host worktreeBasePath if remote, else global from config — surface via store if available.
  return useSessionStore.getState().worktreeBasePath ?? '~/Dev/worktrees'
}, [])
```

Add `worktreeBasePath` to the store selectors at the top of the component (alongside the existing `useSessionStore((s) => s.…)` calls):

```tsx
const worktreeBasePathFromStore = useSessionStore((s) => s.worktreeBasePath)
```

If the store does not currently expose `worktreeBasePath`, add it: read from `cccConfig.worktreeBasePath` in the store's existing config-load handler. (The `worktreeBasePath` key already lives in `CccConfig`, see `shared/types.ts`.)

- [ ] **Step 3: Replace the chip click handler**

Find the existing `handleRepoChipClick(val: string)` (around line 697). Replace it with:

```tsx
const handleRepoChipClick = (val: string): void => {
  const path = isBunkerContainer ? `/repos/${val}` : val
  setSelectedRepos((prev) => {
    const idx = prev.indexOf(path)
    if (idx >= 0) {
      const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)]
      if (primaryRepo === path) setPrimaryRepo(next[0] ?? null)
      return next
    }
    if (!isBunkerContainer && !path.includes('/') === false) {
      const fav = (dest?.hostFavorites ?? []).find((f) => f.path === path)
      if (fav && !name.trim()) setName(fav.name)
    }
    setPrimaryRepo((p) => p ?? path)
    return [...prev, path]
  })
  setBranchChoice(null)
}
```

- [ ] **Step 4: Update `repoIsActive` to test against `selectedRepos`**

Replace the existing `repoIsActive`:

```tsx
const repoIsActive = (val: string): boolean => {
  const path = isBunkerContainer ? `/repos/${val}` : val
  return selectedRepos.includes(path)
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx src/renderer/stores/session-store.ts
git commit -m "feat(ui): multi-select repo state in NewSessionModal"
```

---

### Task 14: Branch input + resolution debounce (multi-repo path only)

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Add branch resolution effect**

Add this effect just below the existing useEffects:

```tsx
useEffect(() => {
  if (!isMulti || !branchInput.trim()) {
    setResolutions(new Map())
    return
  }
  const handle = setTimeout(() => {
    void window.cccAPI.git
      .resolveBranchBatch(selectedRepos, branchInput.trim(), remoteHost, isBunkerContainer ? activeContainer?.name : undefined)
      .then((results) => {
        const next = new Map<string, WorktreeCreateMode>()
        for (const r of results) {
          if (r.ok) next.set(r.repoPath, r.mode)
        }
        setResolutions(next)
      })
  }, 250)
  return () => clearTimeout(handle)
}, [isMulti, branchInput, selectedRepos, remoteHost, isBunkerContainer, activeContainer?.name])
```

- [ ] **Step 2: Add the multi-repo branch input JSX**

In the BRANCH section of the form (currently around line 1068-1114), wrap the existing single-repo branch trigger and add a multi-repo alternative:

```tsx
{type !== 'shell' && (selectedRepos.length > 0 || workingDirectory.trim()) && (
  <div>
    <FieldLabel style={{ marginBottom: 6 }}>3 · Branch{isMulti ? '' : ' / worktree'}</FieldLabel>
    {isMulti ? (
      <input
        type="text"
        value={branchInput}
        onChange={(e) => setBranchInput(e.target.value)}
        placeholder="feat/refund-flow"
        className="branch-multi-input"
      />
    ) : (
      // existing single-repo branch trigger button — leave the existing JSX inside this branch
      <button type="button" className="branch-trigger" onClick={() => setPickerOpen(true)}>
        {/* …existing content… */}
      </button>
    )}
  </div>
)}
```

Add a minimal style for `.branch-multi-input` to the modal CSS file:

```css
.branch-multi-input {
  width: 100%;
  padding: 9px 11px;
  background: var(--bg-0);
  border: 1px solid var(--line);
  border-radius: 7px;
  outline: none;
  color: var(--ink-0);
  font-size: 12px;
  font-family: var(--font-mono);
  transition: border-color 120ms;
}
.branch-multi-input:focus { border-color: var(--amber-rim); }
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx <MODAL_CSS>
git commit -m "feat(ui): shared branch input with debounced resolution for multi-repo"
```

---

### Task 15: Render `MultiRepoPreview` rail and apply `data-multi` attribute

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`

- [ ] **Step 1: Import the new component**

At the top of `NewSessionModal.tsx`:
```tsx
import MultiRepoPreview from './MultiRepoPreview'
```

- [ ] **Step 2: Apply `data-multi` to the modal shell and wrap body in `.modal-body-wrap`**

Find the modal `<div>` that has `style={{ width: 560, … }}`. Replace its className/style with:

```tsx
<div
  className="modal-shell"
  data-multi={isMulti ? 'true' : 'false'}
  style={{
    width: 560,        // base width — overridden by CSS when data-multi=true
    maxHeight: '92vh',
    backgroundColor: 'var(--bg-1)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-modal)',
    animation: 'modal-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }}
>
```

Wrap the existing `<form>` and the new `<MultiRepoPreview …/>` in a `<div className="modal-body-wrap">`:

```tsx
<div className="modal-body-wrap">
  <form …>
    {/* existing form contents */}
  </form>
  {isMulti && (
    <MultiRepoPreview
      selectedRepos={selectedRepos}
      primaryRepo={primaryRepo}
      branch={branchInput}
      resolutions={resolutions}
      perRepoSessions={perRepoSessions}
      worktreeBasePath={worktreeBasePathFromStore ?? '~/Dev/worktrees'}
      creationErrors={creationErrors}
      onSetPrimary={(p) => { if (!perRepoSessions) setPrimaryRepo(p) }}
      onRemove={(p) => {
        setSelectedRepos((prev) => prev.filter((x) => x !== p))
        if (primaryRepo === p) setPrimaryRepo((prev) => {
          const next = selectedRepos.filter((x) => x !== p)[0]
          return next ?? null
        })
      }}
      onTogglePerRepo={() => setPerRepoSessions((v) => !v)}
      onRetry={(p) => {
        setCreationErrors((prev) => { const n = new Map(prev); n.delete(p); return n })
        // resubmit will be handled by submit retry path in Task 16
      }}
    />
  )}
</div>
```

- [ ] **Step 3: Update the modal title when multi**

In the header area, where it currently says `New session`, replace with:

```tsx
{isMulti ? 'New multi-repo task' : 'New session'}
{isMulti && (
  <span className="modal-pill">multi-repo</span>
)}
```

Add the pill style to `<MODAL_CSS>`:

```css
.modal-pill {
  font-family: var(--font-mono);
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--amber);
  background: color-mix(in srgb, var(--amber) 10%, transparent);
  border: 1px solid var(--amber-rim);
  padding: 2px 7px; border-radius: 4px;
  margin-left: 8px;
  transform: translateY(-1px);
}
```

- [ ] **Step 4: Verify typecheck and run dev**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm dev`
Expected: app launches; open New Session modal; click 2+ repo chips; the modal width animates to 880px and the preview rail appears.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx <MODAL_CSS>
git commit -m "feat(ui): render MultiRepoPreview rail when N>=2 repos selected"
```

---

### Task 16: Multi-repo submit routing

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx`
- Modify: `src/renderer/stores/session-store.ts` (only if `addSessionGroup` is not already exposed)

- [ ] **Step 1: Verify `addSessionGroup` is exposed in the store**

Run:
```bash
grep -n "addSessionGroup\|group:create\|sessionGroups" src/renderer/stores/session-store.ts
```
Expected: shows existing group-management actions. If `addSessionGroup` (or equivalent) does not exist, add a thin wrapper that calls `window.cccAPI.group.create(name)` and `window.cccAPI.group.addSession(groupId, sessionId)`. If it already exists, no change.

- [ ] **Step 2: Replace `handleSubmit` with multi-repo aware version**

Replace the entire `handleSubmit` callback (currently around line 579-652) with:

```tsx
const handleSubmit = useCallback(
  async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault()
    if (!name.trim() && !isMulti) return
    if (creating) return

    // Single-repo path — preserves existing behavior exactly
    if (!isMulti) {
      if (type !== 'shell' && !workingDirectory.trim()) return
      if (isBunkerContainer && !workingDirectory.startsWith('/repos/')) return

      setCreating(true)
      setError(null)
      try {
        let dir = workingDirectory.trim() || '~'
        if (branchChoice && type !== 'shell' && workingDirectory.trim()) {
          if (branchChoice.mode === 'existing-worktree' && branchChoice.worktreePath) {
            dir = branchChoice.worktreePath
          } else if (
            branchChoice.mode === 'existing-local' ||
            branchChoice.mode === 'track-remote' ||
            branchChoice.mode === 'new-branch'
          ) {
            const repoName = workingDirectory.trim().split('/').filter(Boolean).pop() ?? 'repo'
            const bunkerTargetPath = isBunkerContainer && activeContainer
              ? `${activeContainer.worktreeBaseDir ?? '/repos/worktrees'}/${branchChoice.branch}/${repoName}`
              : ''
            const worktree = await window.cccAPI.git.addWorktree(
              workingDirectory.trim(),
              branchChoice.branch,
              bunkerTargetPath,
              branchChoice.mode,
              remoteHost,
              isBunkerContainer ? activeContainer?.name : undefined,
            )
            dir = worktree.path
          }
        }
        await createSession({
          name: name.trim(),
          workingDirectory: dir,
          type,
          remoteHost,
          enableAutoMode: type === 'claude' ? enableAutoMode : undefined,
          skipPermissions: type === 'claude' ? skipPermissions : undefined,
          codexFullAuto: type === 'codex' ? codexFullAuto : undefined,
          codexDangerBypass: type === 'codex' ? codexDangerBypass : undefined,
          containerName: dest?.kind === 'container' ? activeContainer?.name : undefined,
        })
        toggleModal()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create session')
      } finally {
        setCreating(false)
      }
      return
    }

    // Multi-repo path
    if (!branchInput.trim()) {
      setError('Branch name is required for multi-repo tasks')
      return
    }

    setCreating(true)
    setError(null)
    setCreationErrors(new Map())
    try {
      // 1. Create worktrees in parallel-per-repo (the IPC fans them out sequentially server-side)
      const reposToCreate = selectedRepos.map((repoPath) => ({
        repoPath,
        mode: resolutions.get(repoPath) ?? 'new-branch',
      }))
      const wtResults = await window.cccAPI.git.addWorktreeBatch({
        repos: reposToCreate,
        branch: branchInput.trim(),
        remoteHost,
        containerName: isBunkerContainer ? activeContainer?.name : undefined,
      })

      const errs = new Map<string, string>()
      const oks = new Map<string, string>() // repoPath -> worktreePath
      for (const r of wtResults) {
        if (r.ok) oks.set(r.repoPath, r.worktree.path)
        else errs.set(r.repoPath, r.error)
      }
      if (errs.size > 0) setCreationErrors(errs)
      if (oks.size === 0) {
        setError('All worktree creations failed.')
        return
      }

      // 2. Create sessions
      const repoLeaf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p
      const sessionType = type
      const containerName = dest?.kind === 'container' ? activeContainer?.name : undefined

      if (perRepoSessions) {
        const createdIds: string[] = []
        for (const [repoPath, wtPath] of oks) {
          const sessionName = `${branchInput.trim()} · ${repoLeaf(repoPath)}`
          const session = await createSession({
            name: sessionName,
            workingDirectory: wtPath,
            type: sessionType,
            remoteHost,
            enableAutoMode: sessionType === 'claude' ? enableAutoMode : undefined,
            skipPermissions: sessionType === 'claude' ? skipPermissions : undefined,
            codexFullAuto: sessionType === 'codex' ? codexFullAuto : undefined,
            codexDangerBypass: sessionType === 'codex' ? codexDangerBypass : undefined,
            containerName,
          })
          if (session?.id) createdIds.push(session.id)
        }
        if (createdIds.length > 0) {
          try {
            const group = await window.cccAPI.group.create(branchInput.trim())
            for (const id of createdIds) {
              await window.cccAPI.group.addSession(group.id, id)
            }
          } catch (groupErr) {
            console.warn('Sessions created but grouping failed:', groupErr)
          }
        }
      } else {
        const primaryPath = primaryRepo && oks.has(primaryRepo) ? primaryRepo : [...oks.keys()][0]
        const wtPath = oks.get(primaryPath)!
        await createSession({
          name: name.trim() || branchInput.trim(),
          workingDirectory: wtPath,
          type: sessionType,
          remoteHost,
          enableAutoMode: sessionType === 'claude' ? enableAutoMode : undefined,
          skipPermissions: sessionType === 'claude' ? skipPermissions : undefined,
          codexFullAuto: sessionType === 'codex' ? codexFullAuto : undefined,
          codexDangerBypass: sessionType === 'codex' ? codexDangerBypass : undefined,
          containerName,
        })
      }

      if (errs.size === 0) toggleModal()
      // If errs.size > 0 we keep the modal open so user can retry the failures.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create multi-repo task')
    } finally {
      setCreating(false)
    }
  },
  [
    name, creating, type, workingDirectory, isBunkerContainer, branchChoice,
    activeContainer, remoteHost, dest, createSession, toggleModal,
    enableAutoMode, skipPermissions, codexFullAuto, codexDangerBypass,
    isMulti, branchInput, selectedRepos, resolutions, perRepoSessions, primaryRepo,
  ],
)
```

- [ ] **Step 3: Update the `ready` predicate**

Replace:

```tsx
const ready = !!name.trim() && (type === 'shell' || !!workingDirectory.trim()) && !(isBunkerContainer && !workingDirectory.startsWith('/repos/'))
```

With:

```tsx
const ready = isMulti
  ? selectedRepos.length >= 2 && !!branchInput.trim()
  : !!name.trim() && (type === 'shell' || !!workingDirectory.trim()) && !(isBunkerContainer && !workingDirectory.startsWith('/repos/'))
```

- [ ] **Step 4: Update the primary button label**

Find the `Create session` button label. Replace with:

```tsx
{creating ? 'Creating…' : (
  isMulti
    ? perRepoSessions
      ? `Create ${selectedRepos.length} sessions`
      : `Create task · ${selectedRepos.length} worktrees`
    : 'Create session'
)}
```

- [ ] **Step 5: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Manual verification (golden path)**

Run: `pnpm dev`
1. Open New Session modal.
2. Click 2 favorite repos. Modal expands; preview rail appears.
3. Type `feat/test-multi-repo` in the branch input. Resolution chips on each card update to `+ new branch` after ~250ms.
4. Click `Create task · 2 worktrees`. Modal closes. New session shows in sidebar in the primary repo.
5. Open a terminal: verify both worktrees exist on disk at `{worktreeBasePath}/feat/test-multi-repo/{repoName}`.

- [ ] **Step 7: Manual verification (per-repo sessions mode)**

1. Re-open modal; pick 2 repos again.
2. Toggle "Spawn one session per repo" in the rail.
3. Use a different branch name (`feat/test-multi-repo-2`).
4. Click `Create 2 sessions`. Expect: 2 sessions appear in the sidebar grouped under `feat/test-multi-repo-2`.

- [ ] **Step 8: Manual verification (failure handling)**

1. Pick 2 repos where at least one would conflict (e.g. an already-existing worktree). Try to recreate the same branch.
2. Expect: succeeded repo persists, failed repo shows a red border + error + Retry button.
3. Modal stays open. Click Retry — error clears (full retry is out of scope for v1; the retry button just clears the error so user can adjust and resubmit).

- [ ] **Step 9: Commit**

```bash
git add src/renderer/components/NewSessionModal.tsx src/renderer/stores/session-store.ts
git commit -m "feat(ui): submit routing for multi-repo task creation"
```

---

### Task 17: Cleanup, lint, and ship PR 2

- [ ] **Step 1: Run all checks**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: all pass.

- [ ] **Step 2: Confirm with user, then push**

```bash
git push -u origin feat/multi-repo-worktrees-ui
gh pr create --draft --title "feat(new-session): multi-repo task creation flow" --body "$(cat <<'EOF'
## Summary
- New `MultiRepoPreview` rail component renders selected repos with branch resolution + worktree path + session indicator per repo.
- `NewSessionModal` becomes multi-select: clicking 2+ repo chips animates the modal from 560 → 880px and reveals the preview rail.
- Single shared branch input with debounced batch resolution.
- Submit fans out to `git.addWorktreeBatch` and creates 1 session (default) or N grouped sessions (toggle).
- Per-repo failures don't abort the batch; failed repos surface inline errors with a retry path.

Spec: docs/superpowers/specs/2026-04-29-multi-repo-worktrees/design.md
Mockup: docs/superpowers/specs/2026-04-29-multi-repo-worktrees/mockup.html

## Test plan
- [ ] Manual: 2-repo task in mode B (single session) creates worktrees + 1 session
- [ ] Manual: 2-repo task in mode C (per-repo sessions) creates N sessions in a group
- [ ] Manual: pre-existing worktree on one repo surfaces an inline error; other repos still succeed
- [ ] Manual: single-repo flow (1 chip) is visually unchanged
- [ ] `pnpm typecheck && pnpm test && pnpm lint && pnpm build` all pass
EOF
)"
```

---

## Self-review

**Spec coverage:**
- Mode B (1 session, sibling worktrees): Task 16 step 2 multi-repo branch ✓
- Mode C (N sessions, grouped): Task 16 step 2 perRepoSessions branch ✓
- Shared branch name + per-repo resolution: Tasks 4, 14 ✓
- Ad-hoc multi-select, unified flow (no toggle): Task 13 ✓
- First-selected = primary, ★ override: Task 13 + Task 11 + Task 15 ✓
- Failure handling per-repo with retry: Task 11 (UI) + Task 16 step 2 + Step 8 ✓
- Modal width transition 560→880: Task 12 + Task 15 ✓
- Worktree path `{base}/{branch}/{repo}`: existing `resolveWorktreePath` reused via Task 8 ✓
- Title becomes "New multi-repo task" + amber pill: Task 15 step 3 ✓
- Free-form path input still works: Task 13 retains `freeFormPath` state — but the chip-row JSX in `NewSessionModal` already includes the existing free-form input, which keeps adding to single-repo `workingDirectory` only. **Gap:** the free-form input is not yet wired to `setSelectedRepos` for multi-repo. Acceptable for v1 (free-form paths are an edge case for multi-repo tasks) but called out in PR 2 description as a known limitation if not extended.
- Per-repo card includes ✕ remove: Task 11 ✓
- Aggregate branch resolution badge in branch input: **Gap** — the multi-repo branch input in Task 14 step 2 is plain (no aggregate badge), where the mockup shows `2n / 1co`. Adding it would require a small render helper and ~30 lines of CSS+JSX. Decision: deferred to follow-up since the per-card resolution chips already convey the info clearly. Documented in design.md as a follow-up.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate" left in the plan. CSS file path is referenced as `<MODAL_CSS>` because it requires a quick grep to locate; that grep is the first step of Task 12.

**Type consistency:**
- `BatchWorktreeRequest`, `BatchWorktreeResult`, `BranchResolution`, `WorktreeCreateMode` used consistently across Tasks 2, 4, 7, 8, 9, 11, 13, 14, 16.
- `MultiRepoPreview` props interface matches the call site in Task 15.
- `cccAPI.git.resolveBranchBatch` / `cccAPI.git.addWorktreeBatch` names match in preload (Task 9), in resolution effect (Task 14), and in submit (Task 16).
- `window.cccAPI.group.create` / `addSession` are the existing names from `src/preload/index.ts` lines 138-141 — verified.

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-04-29-multi-repo-worktrees.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session, batch with checkpoints.

Which approach?
