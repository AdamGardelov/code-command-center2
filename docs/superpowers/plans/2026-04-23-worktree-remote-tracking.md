# Worktree Remote Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `git worktree add` in CCC2 always produce a worktree whose branch is properly linked to `origin` — whether the branch exists remotely, only locally, or is brand-new.

**Architecture:** Non-blocking `git fetch --prune origin` on picker open; `BranchPicker` shows remote-only branches alongside local ones; `addWorktree` dispatches explicitly on a `mode` parameter passed in by the picker (no more "try, fall back to `-b`" heuristic); brand-new branches get `branch.<name>.remote`/`merge` config so first `git push` (no `-u`) lands on `origin`.

**Tech Stack:** TypeScript, Electron (main + preload + renderer), React 19, Zustand, node-pty + child_process for git. No test framework for `git-service`; manual verification only (per spec).

**Source spec:** `docs/superpowers/specs/2026-04-23-worktree-remote-tracking-design.md`

**Testing note:** This plan does not include automated tests. `src/main/git-service.ts` has no test harness today, and the approved spec explicitly lists automated tests as out of scope. Each task ends with manual verification steps — run them, then commit.

---

## File Structure

**Modified:**
- `src/shared/types.ts` — add `remoteOnly?`, `WorktreeCreateMode`, update `CccAPI.git`
- `src/main/git-service.ts` — add `fetchRemotes`, extend `getBranchMetadata`, rewrite `addWorktree`
- `src/main/ipc/git.ts` — add `git:fetch-remotes` handler; pass `mode` to `addWorktree`
- `src/preload/index.ts` — expose `fetchRemotes`; thread `mode`
- `src/renderer/components/BranchPicker.tsx` — fetch on mount, remote-only rows, `Remote` filter, exact-match promotion, 4-mode result
- `src/renderer/styles/index.css` — remote row styling, offline chip, spinner
- `src/renderer/components/NewSessionModal.tsx` — map 4-mode picker result to backend
- `src/renderer/components/PrSidebar.tsx` — pass `mode: 'track-remote'` when reviewing a PR

**Created:** none.

---

## Task 1: Scaffold types and IPC wiring (no behavior change)

Goal: every subsequent task can land without breaking `pnpm typecheck`. This task makes `mode` optional end-to-end so nothing else needs to change yet, and adds `fetchRemotes` as a stub returning `{ ok: true }`.

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/git-service.ts:109`
- Modify: `src/main/ipc/git.ts`
- Modify: `src/preload/index.ts:117-128`

- [ ] **Step 1: Add `WorktreeCreateMode` and `remoteOnly` to `src/shared/types.ts`**

In `BranchMetadata` (near line 97–110), add an optional `remoteOnly?: boolean` field:

```ts
export interface BranchMetadata {
  branch: string
  isMain: boolean
  hasWorktree: boolean
  worktreePath?: string
  dirty: boolean
  ahead: number
  behind: number
  lastCommitSubject: string
  lastCommitAuthor: string
  lastCommitTimestamp: number
  remote?: string
  stale: boolean
  remoteOnly?: boolean
}
```

At a sensible location above `PrReviewer` (roughly line 111), add:

```ts
export type WorktreeCreateMode = 'existing-local' | 'track-remote' | 'new-branch'
```

In `CccAPI.git` (roughly line 275–281), update `addWorktree` to accept an optional `mode` and add `fetchRemotes`:

```ts
git: {
  listWorktrees: (repoPath: string, remoteHost?: string) => Promise<Worktree[]>
  addWorktree: (
    repoPath: string,
    branch: string,
    targetPath: string,
    mode?: WorktreeCreateMode,
    remoteHost?: string
  ) => Promise<Worktree>
  removeWorktree: (worktreePath: string, remoteHost?: string) => Promise<void>
  listBranches: (repoPath: string, remoteHost?: string) => Promise<string[]>
  getBranchMetadata: (repoPath: string, remoteHost?: string) => Promise<BranchMetadata[]>
  fetchRemotes: (repoPath: string, remoteHost?: string) => Promise<{ ok: boolean; error?: string }>
}
```

Note the argument order change for `addWorktree` — `mode` slots in before `remoteHost`. Any existing call site without `mode` is still valid because it's optional.

- [ ] **Step 2: Stub `fetchRemotes` in `GitService`**

In `src/main/git-service.ts`, add a method on the class (placement after `listBranches` is fine):

```ts
fetchRemotes(_repoPath: string, _remoteHost?: string): { ok: boolean; error?: string } {
  return { ok: true }
}
```

- [ ] **Step 3: Update `addWorktree` signature to accept optional `mode`**

In `src/main/git-service.ts:109`, change the signature only (keep the body unchanged for this task):

```ts
addWorktree(
  repoPath: string,
  branch: string,
  targetPath: string,
  _mode?: 'existing-local' | 'track-remote' | 'new-branch',
  remoteHost?: string
): Worktree {
  // ...existing body unchanged
}
```

The `_mode` param is ignored for now. Underscore prefix is the house convention for unused arguments.

- [ ] **Step 4: Register IPC handlers**

In `src/main/ipc/git.ts`, first add the type import at the top:

```ts
import type { WorktreeCreateMode } from '../../shared/types'
```

Then update the `git:add-worktree` handler to accept `mode` and add a `git:fetch-remotes` handler:

```ts
ipcMain.handle(
  'git:add-worktree',
  async (
    _event,
    repoPath: string,
    branch: string,
    targetPath: string,
    mode?: WorktreeCreateMode,
    remoteHost?: string
  ) => {
    const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost)
    return gitService.addWorktree(repoPath, branch, resolvedPath, mode, remoteHost)
  }
)

ipcMain.handle('git:fetch-remotes', async (_event, repoPath: string, remoteHost?: string) => {
  return gitService.fetchRemotes(repoPath, remoteHost)
})
```

- [ ] **Step 5: Expose via preload**

In `src/preload/index.ts`, first ensure `WorktreeCreateMode` is imported from shared types (the file already imports other types — extend that import). Then update the `git` object (around lines 117–128):

```ts
git: {
  listWorktrees: (repoPath: string, remoteHost?: string) =>
    ipcRenderer.invoke('git:list-worktrees', repoPath, remoteHost),
  addWorktree: (
    repoPath: string,
    branch: string,
    targetPath: string,
    mode?: WorktreeCreateMode,
    remoteHost?: string
  ) => ipcRenderer.invoke('git:add-worktree', repoPath, branch, targetPath, mode, remoteHost),
  removeWorktree: (worktreePath: string, remoteHost?: string) =>
    ipcRenderer.invoke('git:remove-worktree', worktreePath, remoteHost),
  listBranches: (repoPath: string, remoteHost?: string) =>
    ipcRenderer.invoke('git:list-branches', repoPath, remoteHost),
  getBranchMetadata: (repoPath: string, remoteHost?: string) =>
    ipcRenderer.invoke('git:branch-metadata', repoPath, remoteHost),
  fetchRemotes: (repoPath: string, remoteHost?: string) =>
    ipcRenderer.invoke('git:fetch-remotes', repoPath, remoteHost)
}
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/main/git-service.ts src/main/ipc/git.ts src/preload/index.ts
git commit -m "chore(git): scaffold fetchRemotes and addWorktree mode (no-op)"
```

---

## Task 2: Implement `GitService.fetchRemotes`

Goal: replace the stub with a real `git fetch --prune origin`.

**Files:**
- Modify: `src/main/git-service.ts` (`fetchRemotes` method)

- [ ] **Step 1: Replace the stub**

Replace the `fetchRemotes` stub added in Task 1 with:

```ts
fetchRemotes(repoPath: string, remoteHost?: string): { ok: boolean; error?: string } {
  const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
  const result = this.execDetailed(
    ['-C', expanded, 'fetch', '--prune', 'origin'],
    remoteHost
  )
  if (result.stdout === null) {
    return { ok: false, error: result.stderr || 'fetch failed' }
  }
  return { ok: true }
}
```

Note: `execDetailed` already returns `{ stdout: string | null; stderr: string }`. A `null` stdout means the underlying `execFileSync` threw — that's our signal for fetch failure. `git fetch` normally writes to stderr even on success, so we can't check stderr to detect failure.

- [ ] **Step 2: Bump timeout for remote hosts**

The current `execDetailed` uses `timeout: 10000` unconditionally. `git fetch` over SSH can exceed that on slow links. Update `execDetailed` (around line 32) to pass a configurable timeout:

Change the signature:

```ts
private execDetailed(
  args: string[],
  remoteHost?: string,
  timeoutMs = 10000
): { stdout: string | null; stderr: string } {
```

And in the body, use `timeout: timeoutMs` instead of the hardcoded `10000`.

Then update `fetchRemotes` to pass a longer timeout:

```ts
fetchRemotes(repoPath: string, remoteHost?: string): { ok: boolean; error?: string } {
  const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
  const timeout = remoteHost ? 30000 : 15000
  const result = this.execDetailed(
    ['-C', expanded, 'fetch', '--prune', 'origin'],
    remoteHost,
    timeout
  )
  if (result.stdout === null) {
    return { ok: false, error: result.stderr || 'fetch failed' }
  }
  return { ok: true }
}
```

The `exec` helper is unchanged — existing callers continue using the 10s default. Only `fetchRemotes` opts into the longer timeout.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Manual verification**

Start dev build: `pnpm dev`. Open devtools (Ctrl+Shift+I) → Console. Pick a repo path you have configured as a favorite (or use one of your worktrees), and run:

```js
await window.cccAPI.git.fetchRemotes('/absolute/path/to/repo')
```

Expected: `{ ok: true }`.

Then disable network (turn off Wi-Fi) and run again. Expected: `{ ok: false, error: "..." }` — some stderr text about network, `fatal: unable to access`, or similar. App should remain responsive.

- [ ] **Step 5: Commit**

```bash
git add src/main/git-service.ts
git commit -m "feat(git): implement fetchRemotes with configurable timeout"
```

---

## Task 3: Extend `getBranchMetadata` to include remote-only branches

Goal: rows for branches present in `refs/remotes/origin/*` but missing from `refs/heads/*` now appear with `remoteOnly: true`.

**Files:**
- Modify: `src/main/git-service.ts` (`getBranchMetadata`, around lines 190–272)

- [ ] **Step 1: Rewrite the method body**

Replace the body of `getBranchMetadata` starting at line 190 with the following. The changes are additive — local-branch logic is unchanged; a second `for-each-ref` run collects remote-only branches, and they're appended to results.

```ts
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

  const localOut = this.exec(
    ['-C', expanded, 'for-each-ref', `--format=${format}`, 'refs/heads'],
    remoteHost
  )

  const now = Math.floor(Date.now() / 1000)
  const thirtyDays = 60 * 60 * 24 * 30
  const results: BranchMetadata[] = []
  const localBranchNames = new Set<string>()

  if (localOut) {
    for (const line of localOut.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split(sep)
      const branch = parts[0] ?? ''
      if (!branch) continue
      localBranchNames.add(branch)
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
        stale,
        remoteOnly: false
      })
    }
  }

  // Append remote-only branches (present on origin, no local counterpart)
  const remoteOut = this.exec(
    ['-C', expanded, 'for-each-ref', `--format=${format}`, 'refs/remotes/origin'],
    remoteHost
  )

  if (remoteOut) {
    for (const line of remoteOut.split('\n')) {
      if (!line.trim()) continue
      const parts = line.split(sep)
      const rawRef = parts[0] ?? ''
      if (!rawRef) continue
      // rawRef looks like "origin/feature/foo" — strip the remote prefix
      const branch = rawRef.startsWith('origin/') ? rawRef.slice('origin/'.length) : rawRef
      if (!branch || branch === 'HEAD') continue
      if (localBranchNames.has(branch)) continue

      const ts = parseInt(parts[3] ?? '0', 10) || 0
      const author = parts[4] ?? ''
      const subject = parts.slice(5).join(sep)

      results.push({
        branch,
        isMain: false,
        hasWorktree: false,
        worktreePath: undefined,
        dirty: false,
        ahead: 0,
        behind: 0,
        lastCommitSubject: subject,
        lastCommitAuthor: author,
        lastCommitTimestamp: ts,
        remote: rawRef,
        stale: false,
        remoteOnly: true
      })
    }
  }

  results.sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
    if (a.hasWorktree !== b.hasWorktree) return a.hasWorktree ? -1 : 1
    // Local (non-remoteOnly) branches first, then remote-only
    if (!!a.remoteOnly !== !!b.remoteOnly) return a.remoteOnly ? 1 : -1
    return b.lastCommitTimestamp - a.lastCommitTimestamp
  })

  return results
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Manual verification**

In dev build, open the branch picker on a repo where you know a remote branch exists that hasn't been checked out locally (e.g., a teammate's recent branch). First run `git fetch --prune origin` manually in a terminal on that repo so `origin/<branch>` refs are current.

Then open the picker. Expected: the remote-only branch appears in the list. Its row still renders with the default "branch" icon because the UI hasn't been updated yet — that's fine for this commit.

- [ ] **Step 4: Commit**

```bash
git add src/main/git-service.ts
git commit -m "feat(git): surface remote-only branches in branch metadata"
```

---

## Task 4: Rewrite `addWorktree` with mode dispatch

Goal: replace the "try existing, fall back to `-b`" heuristic with explicit mode-driven dispatch. `mode` becomes required.

**Files:**
- Modify: `src/shared/types.ts` — make `mode` required on `CccAPI.git.addWorktree`
- Modify: `src/main/git-service.ts` — rewrite `addWorktree`
- Modify: `src/main/ipc/git.ts` — require `mode`
- Modify: `src/preload/index.ts` — require `mode`

Note: renderer call sites (`NewSessionModal`, `PrSidebar`) are updated in Task 6 after the picker's mode vocabulary is refactored. Between this task and Task 6, **typecheck for the renderer will fail**. To keep commits clean, do Task 4 and Task 5 and Task 6 back-to-back without running the app in between. You can run `pnpm typecheck:node` to verify the main-process changes compile.

- [ ] **Step 1: Rewrite `GitService.addWorktree`**

First, extend the existing shared-types import at the top of `src/main/git-service.ts` to include `WorktreeCreateMode`:

```ts
import type { Worktree, BranchMetadata, CccConfig, WorktreeCreateMode } from '../shared/types'
```

Then replace the method body in `src/main/git-service.ts:109`:

```ts
addWorktree(
  repoPath: string,
  branch: string,
  targetPath: string,
  mode: WorktreeCreateMode,
  remoteHost?: string
): Worktree {
  branch = branch.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\//, '').replace(/^heads\//, '')
  const expanded = remoteHost ? repoPath : repoPath.replace(/^~/, process.env.HOME ?? '')
  const expandedTarget = remoteHost ? targetPath : targetPath.replace(/^~/, process.env.HOME ?? '')

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

  let result: { stdout: string | null; stderr: string }
  if (mode === 'new-branch') {
    result = this.execDetailed(
      ['-C', expanded, 'worktree', 'add', '-b', branch, expandedTarget],
      remoteHost
    )
  } else {
    // existing-local OR track-remote — git DWIMs to origin/<branch> for track-remote
    // because the remote ref is present (caller should have called fetchRemotes first).
    result = this.execDetailed(
      ['-C', expanded, 'worktree', 'add', expandedTarget, branch],
      remoteHost
    )
  }

  if (result.stdout === null) {
    throw new Error(
      `Failed to create worktree for branch "${branch}" at ${expandedTarget}: ${result.stderr}`
    )
  }

  if (mode === 'new-branch') {
    // Preconfigure upstream so first `git push` (no -u) lands on origin/<branch>.
    const setRemote = this.execDetailed(
      ['-C', expanded, 'config', `branch.${branch}.remote`, 'origin'],
      remoteHost
    )
    const setMerge = this.execDetailed(
      ['-C', expanded, 'config', `branch.${branch}.merge`, `refs/heads/${branch}`],
      remoteHost
    )
    if (setRemote.stdout === null || setMerge.stdout === null) {
      console.warn(
        `Worktree created but failed to preconfigure upstream for "${branch}". First push will need -u.`
      )
    }
  }

  this.syncPaths(expanded, expandedTarget, remoteHost)

  return {
    path: expandedTarget,
    branch,
    isMain: false,
    repoPath: expanded
  }
}
```

- [ ] **Step 2: Require `mode` on `CccAPI.git.addWorktree`**

In `src/shared/types.ts`, change the optional `mode?` to required `mode`:

```ts
addWorktree: (
  repoPath: string,
  branch: string,
  targetPath: string,
  mode: WorktreeCreateMode,
  remoteHost?: string
) => Promise<Worktree>
```

- [ ] **Step 3: Update IPC handler**

In `src/main/ipc/git.ts`, change `mode` from optional to required:

```ts
ipcMain.handle(
  'git:add-worktree',
  async (
    _event,
    repoPath: string,
    branch: string,
    targetPath: string,
    mode: WorktreeCreateMode,
    remoteHost?: string
  ) => {
    const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost)
    return gitService.addWorktree(repoPath, branch, resolvedPath, mode, remoteHost)
  }
)
```

- [ ] **Step 4: Update preload**

In `src/preload/index.ts`:

```ts
addWorktree: (
  repoPath: string,
  branch: string,
  targetPath: string,
  mode: WorktreeCreateMode,
  remoteHost?: string
) => ipcRenderer.invoke('git:add-worktree', repoPath, branch, targetPath, mode, remoteHost),
```

- [ ] **Step 5: Verify main-process typecheck**

Run: `pnpm typecheck:node`
Expected: exit 0.

`pnpm typecheck:web` will fail at renderer call sites — expected. Fixed in Task 6. Do NOT commit until Task 6 is done, to keep the repo compilable between commits.

---

## Task 5: Refactor `BranchPickerResult` mode vocabulary

Goal: picker emits the new 4-mode `BranchPickerMode`. Callers (updated in Task 6) will use this directly.

**Files:**
- Modify: `src/renderer/components/BranchPicker.tsx`

- [ ] **Step 1: Replace the mode type and derivation**

In `src/renderer/components/BranchPicker.tsx`, replace the `BranchPickerResult` definition at the top (lines 6–10):

```ts
export type BranchPickerMode =
  | 'existing-worktree'
  | 'existing-local'
  | 'track-remote'
  | 'new-branch'

export interface BranchPickerResult {
  mode: BranchPickerMode
  branch: string
  worktreePath?: string
}
```

Update `confirmRow` (around line 394):

```ts
const confirmRow = (row: ScoredBranch): void => {
  let mode: BranchPickerMode
  if (row.meta.hasWorktree) mode = 'existing-worktree'
  else if (row.meta.remoteOnly) mode = 'track-remote'
  else mode = 'existing-local'

  onConfirm({
    mode,
    branch: row.meta.branch,
    worktreePath: row.meta.worktreePath
  })
}
```

Update `confirmFocused` (around line 402) — only the `mode` literal changes:

```ts
const confirmFocused = (): void => {
  if (isNew && focusIdx === 0) {
    onConfirm({ mode: 'new-branch', branch: query.trim() })
    return
  }
  const row = scored[isNew ? focusIdx - 1 : focusIdx]
  if (row) confirmRow(row)
}
```

Update the inline `onClick` on the "Create new" row (around line 483):

```tsx
onClick={() => onConfirm({ mode: 'new-branch', branch: query.trim() })}
```

- [ ] **Step 2: No typecheck yet**

Still deferred to Task 6 since callers haven't been updated. Don't commit.

---

## Task 6: Update `addWorktree` call sites

Goal: `NewSessionModal` and `PrSidebar` pass the correct mode; typecheck is green end-to-end; we commit Tasks 4–6 together.

**Files:**
- Modify: `src/renderer/components/NewSessionModal.tsx:285-297`
- Modify: `src/renderer/components/PrSidebar.tsx:118`

- [ ] **Step 1: Update `NewSessionModal`**

Replace the block around lines 285–297:

```tsx
if (branchChoice && type !== 'shell' && workingDirectory.trim()) {
  if (branchChoice.mode === 'existing-worktree' && branchChoice.worktreePath) {
    dir = branchChoice.worktreePath
  } else if (
    branchChoice.mode === 'existing-local' ||
    branchChoice.mode === 'track-remote' ||
    branchChoice.mode === 'new-branch'
  ) {
    const worktree = await window.cccAPI.git.addWorktree(
      workingDirectory.trim(),
      branchChoice.branch,
      '',
      branchChoice.mode,
      remoteHost
    )
    dir = worktree.path
  }
}
```

- [ ] **Step 2: Update `PrSidebar`**

At line 118, replace:

```tsx
const worktree = await window.cccAPI.git.addWorktree(repoPath, pr.branch, '')
```

with:

```tsx
const worktree = await window.cccAPI.git.addWorktree(
  repoPath,
  pr.branch,
  '',
  'track-remote'
)
```

Rationale: PR branches always exist on `origin` (that's how GitHub PRs work), so `track-remote` is the correct mode.

- [ ] **Step 3: Verify full typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Manual verification**

Run `pnpm dev`. Open the app. Create a new session with a worktree for:

1. An existing local branch (e.g., `main`) — expect instant check-out, no upstream changes.
2. A brand-new typed name (e.g., `feature/test-upstream`) — expect worktree created. In the worktree directory, run `git config --get branch.feature/test-upstream.remote` → should print `origin`. Then `git log -1 --format=%s` to confirm the branch points at the current `HEAD`.
3. Trigger the PR flow if available — confirm worktree appears; in the worktree run `git branch -vv` and confirm output shows `[origin/<branch>]`.

- [ ] **Step 5: Commit Tasks 4–6 together**

```bash
git add src/shared/types.ts src/main/git-service.ts src/main/ipc/git.ts src/preload/index.ts src/renderer/components/BranchPicker.tsx src/renderer/components/NewSessionModal.tsx src/renderer/components/PrSidebar.tsx
git commit -m "feat(git): explicit mode dispatch for worktree creation"
```

---

## Task 7: Fetch-on-open + offline chip in `BranchPicker`

Goal: non-blocking `git fetch` triggered on picker mount; status surfaced in the header.

**Files:**
- Modify: `src/renderer/components/BranchPicker.tsx`
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Add fetch state**

In `src/renderer/components/BranchPicker.tsx`, just after the existing `useState` declarations in `BranchPicker` (around line 301), add three new pieces of state:

```tsx
const [fetching, setFetching] = useState(false)
const [fetchFailed, setFetchFailed] = useState(false)
const [fetchTick, setFetchTick] = useState(0)
```

`fetchTick` is a separate trigger from the existing `refreshTick` — we need two so the effects don't loop into each other. `fetchTick` drives the fetch; on fetch success, we bump `refreshTick`, which re-runs the existing metadata-loading effect.

Then add a new `useEffect` below the existing metadata-loading effect (after line 326):

```tsx
useEffect(() => {
  let cancelled = false
  setFetching(true)
  setFetchFailed(false)
  window.cccAPI.git
    .fetchRemotes(repoPath, remoteHost)
    .then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setFetchFailed(true)
        return
      }
      setRefreshTick((n) => n + 1)
    })
    .catch(() => {
      if (!cancelled) setFetchFailed(true)
    })
    .finally(() => {
      if (!cancelled) setFetching(false)
    })
  return () => {
    cancelled = true
  }
}, [repoPath, remoteHost, fetchTick])
```

- [ ] **Step 2: Expose a manual refresh handler**

Add near other handlers (after `handleDelete`):

```tsx
const handleManualRefresh = (): void => {
  setFetchTick((n) => n + 1)
}
```

- [ ] **Step 3: Render the spinner and chip**

In the header JSX (around the `bp-search` block near line 439), update the icon to reflect fetch state and add the chip:

```tsx
<div className="bp-header">
  <div className="bp-search">
    <button
      type="button"
      className={`bp-refresh${fetching ? ' spinning' : ''}`}
      onClick={handleManualRefresh}
      title={fetching ? 'Fetching from origin…' : 'Refresh branch list from origin'}
      disabled={fetching}
    >
      <GitBranch size={14} style={{ color: 'var(--amber)' }} />
    </button>
    <input
      ref={inputRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleKey}
      placeholder="Type a branch name — existing opens worktree, new creates one"
      spellCheck={false}
    />
    {query && (
      <button type="button" className="bp-clear" onClick={() => setQuery('')} title="Clear">
        <X size={11} />
      </button>
    )}
    {fetchFailed && !fetching && (
      <span className="bp-offline-chip" title="Couldn't reach origin — showing cached state">
        offline — cached
      </span>
    )}
  </div>
  {/* ...existing bp-filters block unchanged */}
</div>
```

- [ ] **Step 4: Add styles**

In `src/renderer/styles/index.css`, add after the existing `.bp-search` styles (find a block starting with `.bp-search`):

```css
.bp-refresh {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0 2px 0 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--amber);
}
.bp-refresh:disabled {
  cursor: wait;
}
.bp-refresh.spinning svg {
  animation: bp-spin 0.8s linear infinite;
}
@keyframes bp-spin {
  to { transform: rotate(360deg); }
}
.bp-offline-chip {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-2);
  color: var(--ink-2);
  font-size: 11px;
  font-family: var(--font-mono);
}
```

(Project theme uses `--bg-0/1/2/3` for surfaces and `--ink-0/1/2/3/4` for text tones — already defined in `index.css` around lines 12–27. No blue variable exists in the palette, so the `#7aa7d8` literal used for remote-only rows stays as-is.)

- [ ] **Step 5: Verify typecheck and dev**

Run: `pnpm typecheck` → exit 0.

Run `pnpm dev`. Open the picker:

- On open with network: refresh icon spins briefly, then list updates to include freshly-fetched remote branches. No chip.
- On open with network disabled: icon spins briefly, then `offline — cached` chip appears next to input. Picker still works against cached data.
- Click the refresh icon while online: spins again, metadata reloads.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/BranchPicker.tsx src/renderer/styles/index.css
git commit -m "feat(branch-picker): fetch on open with offline fallback"
```

---

## Task 8: Remote-only row styling in `BranchPicker`

Goal: visually distinguish remote-only rows with a `Cloud` icon and `from origin` badge, plus matching preview tag and confirm label.

**Files:**
- Modify: `src/renderer/components/BranchPicker.tsx`
- Modify: `src/renderer/styles/index.css`

- [ ] **Step 1: Import Cloud icon**

At the top of `BranchPicker.tsx`, update the lucide import:

```ts
import { Cloud, Folder, GitBranch, Plus, X } from 'lucide-react'
```

- [ ] **Step 2: Update `BranchRow` icon branch**

Replace the `<div className="bp-row__icon">` block (around lines 111–125):

```tsx
<div className="bp-row__icon">
  {meta.hasWorktree ? (
    <div
      className={`bp-row__wt${activeSession ? ' active' : ''}`}
      title={activeSession ? `Used by "${activeSession.displayName || activeSession.name}"` : 'Worktree exists'}
    >
      <Folder size={13} />
      {activeSession && <span className="bp-row__wt-dot" />}
    </div>
  ) : meta.remoteOnly ? (
    <div className="bp-row__remote-only" title="Branch on origin — will check out a tracking worktree">
      <Cloud size={13} />
    </div>
  ) : (
    <div className="bp-row__remote" title="Local branch — a worktree will be created">
      <GitBranch size={13} />
    </div>
  )}
</div>
```

- [ ] **Step 3: Add a `from origin` badge**

In the same component, inside the `<span className="bp-row__branch">` (around line 133–144), add a new badge after the main one:

```tsx
{meta.remoteOnly && <span className="bp-row__badge remote">from origin</span>}
```

- [ ] **Step 4: Update the preview tag**

In `Preview` (around lines 215–226), update the tag logic:

```tsx
{meta.hasWorktree ? (
  <span className="bp-preview__tag ok">open existing worktree</span>
) : meta.remoteOnly ? (
  <span className="bp-preview__tag remote">check out from origin</span>
) : (
  <span className="bp-preview__tag new">will create worktree</span>
)}
```

- [ ] **Step 5: Update the confirm button label**

In `BranchPicker` near line 430, update `confirmLabel`:

```tsx
const confirmLabel = isNew && focusIdx === 0
  ? 'Create branch & worktree'
  : hovered?.meta.hasWorktree
    ? 'Open worktree'
    : hovered?.meta.remoteOnly
      ? 'Check out from origin'
      : 'Checkout worktree'
```

- [ ] **Step 6: CSS for the new classes**

In `src/renderer/styles/index.css`, add near the existing `.bp-row__remote` rule:

```css
.bp-row__remote-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7aa7d8; /* muted blue — distinct from amber/ink */
}
.bp-row__badge.remote {
  background: rgba(122, 167, 216, 0.14);
  color: #7aa7d8;
}
.bp-preview__tag.remote {
  background: rgba(122, 167, 216, 0.14);
  color: #7aa7d8;
}
```

No blue variable exists in the current palette (theme uses `--amber` as the accent), so the `#7aa7d8` literal is intentional — it's distinct from any existing status color (`--s-*`) and provider color (`--p-*`) so remote rows read as "not in your repo yet" at a glance.

- [ ] **Step 7: Typecheck & manual verify**

Run: `pnpm typecheck` → exit 0.

Run `pnpm dev`. On a repo with at least one remote-only branch:
- The remote-only row shows the cloud icon and `from origin` badge.
- Selecting it shows `check out from origin` in the preview tag.
- Confirm button reads `Check out from origin`.
- Confirming creates a worktree; inside it `git branch -vv` shows the remote tracked.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/BranchPicker.tsx src/renderer/styles/index.css
git commit -m "feat(branch-picker): visual treatment for remote-only rows"
```

---

## Task 9: `Remote` filter pill + exact-match promotion

Goal: add `Remote` to the filter pill row, and when a typed query exactly matches a remote-only branch, surface it above the "Create new" row.

**Files:**
- Modify: `src/renderer/components/BranchPicker.tsx`

- [ ] **Step 1: Extend `FilterMode` and counts**

In `BranchPicker.tsx`, update the `FilterMode` type (around line 19):

```ts
type FilterMode = 'all' | 'worktrees' | 'in-use' | 'stale' | 'remote'
```

In the `counts` memo (around line 338–346), add a `remote` tally:

```ts
const counts = useMemo(
  () => ({
    all: branches.length,
    worktrees: branches.filter((b) => b.hasWorktree).length,
    stale: branches.filter((b) => b.stale).length,
    inUse: branches.filter((b) => !!sessionUsingBranch(sessions, b)).length,
    remote: branches.filter((b) => b.remoteOnly).length
  }),
  [branches, sessions]
)
```

In the filter application (around line 349–354), add the remote case:

```ts
const base = branches.filter((b) => {
  if (filterMode === 'worktrees') return b.hasWorktree
  if (filterMode === 'stale') return b.stale
  if (filterMode === 'in-use') return !!sessionUsingBranch(sessions, b)
  if (filterMode === 'remote') return b.remoteOnly
  return true
})
```

In the pill row JSX (around lines 456–472), add a fifth pill:

```tsx
{(
  [
    ['all', 'All branches', counts.all],
    ['worktrees', 'With worktree', counts.worktrees],
    ['in-use', 'In use', counts.inUse],
    ['remote', 'Remote', counts.remote],
    ['stale', 'Stale', counts.stale]
  ] as const
).map(([k, label, n]) => (
  <button
    type="button"
    key={k}
    className={`bp-pill${filterMode === k ? ' active' : ''}`}
    onClick={() => setFilterMode(k)}
  >
    {label} <span className="bp-pill__count">{n}</span>
  </button>
))}
```

- [ ] **Step 2: Exact-match promotion**

In the `scored` memo (around lines 348–380), suppress the "create new" affordance when the query exactly matches an existing branch (local or remote-only). The current `exact` check already covers this — verify that `base.some((b) => b.branch === query)` still uses the same `base` collection that includes remote-only branches. Since `base` is derived from `branches` (which now includes remote-only entries after Task 3), this already works.

Still, make it explicit. Replace lines 378–379:

```ts
const exact = branches.some((b) => b.branch === query)
return { scored: withMeta, isNew: query.length > 0 && !exact }
```

(Change: `base` → `branches` so `exact` matches against the unfiltered list. Prevents the odd case where a user is on the `Worktrees` filter, types a remote branch name, and still gets offered "Create new".)

- [ ] **Step 3: Typecheck & manual verify**

Run: `pnpm typecheck` → exit 0.

Run `pnpm dev`. Open the picker:
- `Remote` pill shows the count of remote-only branches; clicking it filters to them.
- Type the exact name of a remote-only branch: its row stays visible, no "Create new" prompt.
- Type a name that doesn't exist anywhere: "Create new" prompt appears.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/BranchPicker.tsx
git commit -m "feat(branch-picker): remote filter pill and exact-match promotion"
```

---

## Task 10: End-to-end manual verification

Goal: walk through all four scenarios from the spec and confirm end-to-end behavior.

- [ ] **Step 1: Review flow**

Set up: have a teammate (or yourself from another clone) push a new branch to `origin`. In the local clone, do NOT run `git fetch` before opening the app.

1. Run `pnpm dev`.
2. Open New Session modal, select the repo path as working directory.
3. Open branch picker. Observe refresh spinner.
4. After fetch completes, find the new branch in the list (cloud icon, `from origin` badge).
5. Confirm. Worktree is created.
6. In a terminal, `cd` into the worktree and run `git branch -vv`. Expected: current branch name, shows `[origin/<branch>]` tracking.

- [ ] **Step 2: New-branch flow**

1. Open the picker on a repo.
2. Type a name that does not exist anywhere, e.g. `test/plan-verification`.
3. Confirm via "Create new branch". Worktree is created.
4. `cd` into the worktree. Run `git config --get branch.test/plan-verification.remote` → expected `origin`.
5. Run `git config --get branch.test/plan-verification.merge` → expected `refs/heads/test/plan-verification`.
6. Add a trivial commit, run `git push` (no `-u`). Expected: push succeeds and creates `origin/test/plan-verification`.
7. Clean up: in the repo, `git worktree remove <path>`; on origin, `git push origin --delete test/plan-verification`.

- [ ] **Step 3: Offline flow**

1. Disable network.
2. Open the picker. Spinner shows briefly, then `offline — cached` chip appears.
3. List is populated from the previous cached state.
4. Confirming a local branch works. Confirming a remote-only branch whose `origin/<branch>` ref is already present locally works. Confirming one whose ref was never fetched produces a clear error toast from git.

- [ ] **Step 4: SSH flow**

Only if a `remoteHost` is configured:

1. Set up a new branch on the remote host's clone via SSH.
2. In the app, open the picker against that remote host's repo.
3. Fetch should run over SSH (may take longer; the 30s timeout should be enough).
4. Remote branch appears; confirming creates a tracking worktree on the remote host.

- [ ] **Step 5: Lint + final typecheck**

Run: `pnpm lint` → exit 0.
Run: `pnpm typecheck` → exit 0.

If lint surfaces unused variables in `addWorktree` from earlier scaffolding (unlikely), clean them up and commit as `chore: lint`.

- [ ] **Step 6: No commit if verification passes without changes**

If all verifications pass and no code changed during this task, no commit needed — the feature is done.
