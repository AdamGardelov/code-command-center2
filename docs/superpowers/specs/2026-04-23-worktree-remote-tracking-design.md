# Worktree remote-tracking design

## Problem

Creating a worktree for a branch name that exists on `origin` (either for review, or for
"someone else pushed this branch") produces a local branch with **no upstream**. Pushing
from that worktree requires the user to remember `git push -u origin <branch>`. Creating
a worktree for a brand-new branch has the same problem on first push.

Two concrete use cases motivating this spec:

1. **Review flow.** User wants to check out `feature/jadajada` that a teammate pushed. Today,
   if the local view of `origin` is stale (or the branch was never fetched), the picker has
   no row for it, the user types the name, `addWorktree` falls back to `-b`, and a fresh
   local branch is created from `HEAD` — no connection to the remote branch at all.
2. **New-branch flow.** User starts `feature/new-thing`. `git push` later fails with the
   familiar "the current branch has no upstream" message.

## Root cause

In `src/main/git-service.ts` (`addWorktree`, lines 109–150):

```ts
const existing = this.execDetailed(['-C', expanded, 'worktree', 'add', expandedTarget, branch], remoteHost)
if (result === null) {
  const created = this.execDetailed(['-C', expanded, 'worktree', 'add', '-b', branch, expandedTarget], remoteHost)
}
```

The first call DWIMs to `origin/<branch>` **only if `refs/remotes/origin/<branch>` is
already present locally**. Nothing in the app ever runs `git fetch`, so a stale local view
silently falls into the `-b` fallback and creates a detached-from-remote branch.

Additionally, `getBranchMetadata` (line 213) only iterates `refs/heads` — remote-only
branches are invisible to the picker.

## Solution overview

Three changes:

1. **Fetch on picker open** (non-blocking). Picker renders cached state instantly, updates
   when `git fetch --prune origin` returns.
2. **Surface remote-only branches** in the picker with a distinct visual treatment.
3. **Three explicit creation modes** in `addWorktree`, driven by what the picker selected,
   replacing the "try then fall back" heuristic.

## Backend changes (`src/main/git-service.ts`)

### New: `fetchRemotes`

```ts
fetchRemotes(repoPath: string, remoteHost?: string): { ok: boolean; error?: string }
```

- Runs `git fetch --prune origin`.
- `--prune` so branches deleted on `origin` disappear from the picker.
- Returns `{ ok: false, error }` on failure instead of throwing — offline/auth errors must
  not crash the picker.
- Timeout: 15s local, 30s when `remoteHost` is set (via `execDetailed`'s `timeout`).
- Scope: only `origin`. Multi-remote support is out of scope (see Non-goals).

### Changed: `getBranchMetadata`

Extended to also emit rows for branches that exist in `refs/remotes/origin/*` but have no
counterpart in `refs/heads/*`.

- Run `for-each-ref` with the same format on `refs/remotes/origin`.
- Skip `refs/remotes/origin/HEAD` (symbolic).
- For each remote-only branch, emit a `BranchMetadata` with `remoteOnly: true`,
  `hasWorktree: false`, `ahead: 0`, `behind: 0`, `dirty: false`, and commit fields populated
  from the remote ref.
- Local branches keep their existing sort priority; remote-only rows sort after them by
  commit timestamp.

### Changed: `addWorktree`

Signature adds a required `mode` parameter:

```ts
type WorktreeCreateMode = 'existing-local' | 'track-remote' | 'new-branch'

addWorktree(
  repoPath: string,
  branch: string,
  targetPath: string,
  mode: WorktreeCreateMode,
  remoteHost?: string
): Worktree
```

Dispatch by mode — no fallback chains:

- **`existing-local`** — `git worktree add <path> <branch>`. Fails if the branch isn't
  actually local (renderer should never send this mode in that case).
- **`track-remote`** — `git worktree add <path> <branch>`. Git auto-DWIMs to a tracking
  branch because the remote ref is present (guaranteed by the preceding fetch).
- **`new-branch`** — `git worktree add -b <branch> <path>`, then
  `git config branch.<branch>.remote origin` and
  `git config branch.<branch>.merge refs/heads/<branch>`. First `git push` (no `-u`)
  lands on `origin/<branch>`. If the two config calls fail, log a warning and continue —
  the worktree exists and the user can still `git push -u` manually.

The existing branch-prefix stripping (`refs/heads/`, `refs/remotes/`, `heads/`) stays.

## IPC / preload / types

### `src/shared/types.ts`

```ts
export interface BranchMetadata {
  // ...existing fields
  remoteOnly?: boolean
}

export type WorktreeCreateMode = 'existing-local' | 'track-remote' | 'new-branch'

export interface CccAPI {
  git: {
    // ...existing
    addWorktree: (
      repoPath: string,
      branch: string,
      targetPath: string,
      mode: WorktreeCreateMode,
      remoteHost?: string
    ) => Promise<Worktree>
    fetchRemotes: (repoPath: string, remoteHost?: string) => Promise<{ ok: boolean; error?: string }>
  }
}
```

### `src/main/ipc/git.ts`

Add `git:fetch-remotes` handler; update `git:add-worktree` handler to accept and pass the
new `mode` argument.

### `src/preload/index.ts`

Expose `fetchRemotes`. Update `addWorktree` to forward `mode`.

## Frontend changes (`src/renderer/components/BranchPicker.tsx`)

### Fetch on mount

On mount: render cached `getBranchMetadata` immediately, then start `fetchRemotes` in
parallel. When fetch resolves successfully, re-run `getBranchMetadata` and merge the result
into state. On failure, flip a `fetchFailed` flag that surfaces an "offline — cached" chip
in the header.

A small spinner/refresh icon next to the `GitBranch` glyph in the search bar shows
fetch-in-progress. Clicking it re-runs `fetchRemotes`.

Refetch cadence: only on mount and on manual click. No polling.

### Remote-only row treatment

- Icon: `Cloud` (lucide) in a muted blue (new CSS var or reuse `--ink-3`).
- Badge: `from origin`.
- Preview tag: `check out from origin` (replaces `will create worktree`).
- Confirm label when focused: `Check out from origin`.
- No delete button (there's nothing local to delete).

### New filter pill

Add `Remote` to the pill row, filtering to `remoteOnly: true`. Counts update alongside the
existing `All / With worktree / In use / Stale`.

### Typed-name match promotion

If the user types a name that matches a remote-only branch exactly, surface that row above
the "Create new branch" prompt. Prevents accidentally creating a duplicate local branch
when the remote one already exists.

### `BranchPickerResult` changes

```ts
type BranchPickerMode =
  | 'existing-worktree'  // worktree already exists, just open it
  | 'existing-local'     // local branch, no worktree yet
  | 'track-remote'       // remote-only branch
  | 'new-branch'         // typed name, not found anywhere

export interface BranchPickerResult {
  mode: BranchPickerMode
  branch: string
  worktreePath?: string
}
```

Mode derivation in the picker:

- Row has `meta.worktreePath` → `existing-worktree`.
- Row has `meta.remoteOnly === true` → `track-remote`.
- Row is a local branch with no worktree → `existing-local`.
- "Create new" row → `new-branch`.

Consumers of `BranchPickerResult` (callers of `<BranchPicker onConfirm>`) translate
`mode` to the right IPC call. `existing-worktree` skips `addWorktree` entirely; the other
three forward their `mode` straight to `cccAPI.git.addWorktree`.

## Error handling

- Fetch failure: non-blocking chip, picker stays functional on cached data.
- Confirming `track-remote` while offline with the remote ref missing locally: git itself
  errors, we surface the message in a toast. Rare — the fetch would have failed louder
  first.
- `git config` failure after `-b`: logged warning, worktree still created.
- Ambiguous multi-remote DWIM: git errors out, surfaced as a toast. Won't happen in the
  `origin`-only list, only if a user somehow has multiple remotes with matching names and
  git's DWIM kicks in.

## Non-goals

- Multi-remote support (only `origin`). Adding `upstream` / fork remotes doubles the
  surface area and nobody asked for it yet.
- Automatic first-push for new branches. Pre-configuring `branch.*.remote` and
  `branch.*.merge` is enough — the user's normal `git push` will do the right thing.
- Review-mode detached HEAD. User opted in to use worktrees with tracking; if that ever
  becomes a problem we can add it later.
- Tests. `git-service.ts` has no automated tests today; adding an integration harness for
  git is out of scope for this change.

## Scope estimate

~250–350 lines of meaningful diff across:

- `src/main/git-service.ts` — fetch method, metadata extension, dispatch by mode
- `src/main/ipc/git.ts` — new handler, updated handler
- `src/preload/index.ts` — expose `fetchRemotes`, thread `mode`
- `src/shared/types.ts` — `remoteOnly` + `WorktreeCreateMode` + API typing
- `src/renderer/components/BranchPicker.tsx` — fetch-on-open, remote rows, filter, mode
- `src/renderer/styles/index.css` — remote row styling, offline chip, spinner

Single PR.

## Manual verification

Before claiming done:

1. Review flow: teammate pushes `feature/foo`. Open picker locally. `feature/foo` appears
   with `from origin` badge. Confirm → worktree created, `git branch -vv` in the worktree
   shows `[origin/feature/foo]` tracking.
2. New-branch flow: type `feature/new-thing` (not on remote). Confirm. `cd` into worktree,
   add a commit, `git push` (no `-u`). Succeeds and creates `origin/feature/new-thing`.
3. Offline flow: disable network. Open picker. Cached state renders, chip shows
   "offline — cached". Confirming a local branch still works.
4. SSH flow: same as #1 against a configured `remoteHost`.
