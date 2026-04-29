# Multi-repo worktrees in the New Session flow

**Status:** approved · **Date:** 2026-04-29

## Problem

A "task" frequently spans multiple repos — e.g. a refund flow change touches `Wint.Salary`, `Wint.Core`, and `Wint.Client.Web` simultaneously. Today the New Session modal creates exactly one worktree against exactly one repo. Users either spin up three sessions one at a time (each with its own worktree creation roundtrip) or skip worktrees entirely and work on bare branches — losing the isolation that's the whole point of CCC2's session model.

## Goal

Let a user, in one pass through the New Session modal, create N worktrees across N selected repos on a shared branch name, and either:

- **Mode B (default):** spin up a single Claude/Codex session in the *primary* repo, with the other repos' worktrees ready for ad-hoc attachment later.
- **Mode C (opt-in):** spin up N sessions (one per repo), automatically grouped under a `SessionGroup` named after the branch.

Single-repo behavior must remain unchanged — no new mode toggle, no extra clicks for the existing happy path.

## Non-goals

- Per-repo branch names. v1 enforces a single shared branch name across all selected repos. Mixed-branch tasks fall back to creating sessions individually.
- Saved repo bundles. Bundle persistence is a future enhancement; v1 is purely ad-hoc multi-select.
- Cross-host multi-repo. The N selected repos must live on the same destination (host or container).
- A new top-level `Task` entity. v1 leverages the existing `SessionGroup` for Mode C; the "task" exists only as a branch name + a set of co-located worktrees.

## User flow

1. User opens New Session modal as today.
2. Modal shows the existing single-repo flow (560px wide, no preview rail).
3. User clicks a repo chip — selected, becomes primary, modal stays single-repo.
4. User clicks a second repo chip:
   - Modal width animates to ~880px.
   - Right-side **Task preview** rail slides in.
   - Modal title becomes "New multi-repo task" with an amber `multi-repo` pill.
   - Branch input replaces the per-repo `BranchPicker`. A single shared branch name is applied to all selected repos.
   - Each selected repo gets a preview card showing: branch resolution mode (new / checkout / track), full worktree path (`{base}/{branch}/{repo}`), session indicator (★ + "session here" for primary, dashed-pip + "worktree only" for siblings).
5. User adjusts: types a branch name, optionally changes primary by clicking a star, optionally enables "Spawn one session per repo" toggle.
6. User submits. Backend creates worktrees per repo (best-effort, atomic-per-repo), then creates 1 session (Mode B) or N sessions + a `SessionGroup` (Mode C).
7. Per-repo failures are surfaced inline with a retry affordance; successes persist regardless of failures.

## UX specification

The reference mockup is at [`./mockup.html`](./mockup.html) — open in any browser to interact.

### Modal layout

- **N=1:** modal width 560px. Right rail hidden. Branch picker is the existing `BranchPicker` component (unchanged behavior).
- **N≥2:** modal width animates to 880px (280ms ease). Right rail (`360px` wide) slides in. The legacy `BranchPicker` is replaced by a single shared **branch input**.

### Repo selector

- Existing favorite chips become multi-select.
- Active chips show:
  - A filled checkbox indicator on the left.
  - An order number (1, 2, 3…) showing selection order.
  - A ★ on the chip whose order is currently primary (mode B only).
- The free-form path input remains as a tail "chip" — typing a path adds it to the selection.
- Deselect by clicking the chip again, or via the ✕ on the preview card.

### Branch input (multi-repo)

- Single `<input>` accepting a branch name.
- Right-side resolution badge shows aggregate state:
  - `3× new` — branch doesn't exist in any selected repo.
  - `3× checkout` — branch exists locally in all selected repos.
  - `2n / 1co` — mixed (2 new, 1 checkout). Compact.
- Per-repo resolution shown explicitly on each preview card.

### Preview rail

- Header: "TASK PREVIEW" + repo count (`3 repos`) right-aligned.
- One card per selected repo:
  - **Repo name** (mono).
  - **Star button** — primary indicator. Click to make this the primary (mode B only; hidden / disabled in mode C).
  - **Remove button (✕)** — drop this repo from the selection.
  - **Resolution chip** — `+ new branch`, `checkout existing`, or `track origin/<branch>`.
  - **Session flag** — solid amber pip + "session here" for primary; dashed pip + "worktree only" for siblings (mode B). In mode C, all cards show solid amber pip + "session: <branch> · <repo-suffix>".
  - **Worktree path** — full path with `{base}` dim, `{branch}` amber, `{repo}` ink-1. Reinforces the path convention visually.
- Cards stagger in (260ms) when added.
- Scrollable if list exceeds rail height.

### Mode bar (bottom of rail)

- "Spawn one session per repo" toggle. Off = mode B (default). On = mode C.
- One-line live summary below toggle:
  - Mode B: `3 worktrees, 1 session in Wint.Salary · 2 siblings idle`
  - Mode C: `3 worktrees + 3 sessions grouped as feat/refund-flow`

### Footer + primary button

- Status line shows: branch, agent, destination, repo summary.
- Primary button label adapts:
  - N=1: `Create session`
  - N≥2 mode B: `Create task · 3 worktrees`
  - N≥2 mode C: `Create 3 sessions`

## Data model

No schema changes for v1.

- `Session` and `SessionGroup` types remain as today.
- Mode C reuses `SessionGroup` (already in `shared/types.ts`) with `name = branch`.
- Worktrees follow the existing path convention: `{worktreeBasePath}/{branch}/{repoName}` (already enforced — see `git-service.ts` worktree-path computation, lines around 447-455).

## Backend

### IPC

Add a single new IPC handler:

```ts
// src/main/ipc/git.ts (new handler)
'git:addWorktreeBatch': (req: {
  repos: Array<{ repoPath: string; mode: WorktreeCreateMode }>
  branch: string
  remoteHost?: string
  containerName?: string
}) => Promise<Array<{
  repoPath: string
  ok: true
  worktree: Worktree
} | {
  repoPath: string
  ok: false
  error: string
}>>
```

Per-repo result is independent. The handler iterates the requested repos, calls `gitService.addWorktree` for each, and collects per-repo results. No transaction — failures don't roll back successful worktrees. The renderer is responsible for presenting per-repo status and offering retry on failures.

### Branch resolution

A new helper `gitService.resolveBranchAcrossRepos(repos, branch, ...) -> Map<repoPath, WorktreeCreateMode>` runs in parallel:

- For each repo, check `git rev-parse --verify refs/heads/<branch>` (local exists?) and `refs/remotes/origin/<branch>` (remote exists?).
- `existing-local` if local exists; `track-remote` if only remote exists; `new-branch` if neither.
- Renderer calls this on branch input change (debounced 250ms) to update preview cards in real time.

### Session creation

Mode B: `createSession` is called once with the primary repo's worktree path.

Mode C: `createSession` is called N times (sequentially to avoid name collisions), then a `SessionGroup` is created with `name = branch` and `sessionIds = [...new session ids]`. Names auto-derive as `{branch} · {repoSuffix}` where `repoSuffix` is the last `.`-segment of the repo name (`Wint.Salary` → `Salary`).

## Frontend

### `NewSessionModal.tsx`

- Component is split: a new `MultiRepoPreview` subcomponent renders the right rail to keep the parent file readable.
- State adds:
  - `selectedRepos: string[]` (ordered).
  - `primaryRepo: string | null`.
  - `perRepoSessions: boolean`.
  - `branchInput: string` (when N≥2; for N=1 the existing `BranchPicker` flow stays).
  - `branchResolutions: Map<repoPath, WorktreeCreateMode>` (debounced fetch).
- Repo chip click handler toggles selection. Selecting the second repo triggers the layout transition (CSS-driven via a `data-multi="true"` attribute on the modal root, mirroring the mockup).
- Submit handler routes to:
  - Single-repo: existing `handleSubmit` path (unchanged).
  - Multi-repo: calls `git:addWorktreeBatch`, then either one `createSession` (mode B) or N `createSession` + `addSessionGroup` (mode C). Per-repo errors are stored in a `creationErrors: Map<repoPath, string>` and rendered as inline error chips on the preview cards with a retry button.

### Subcomponent: `MultiRepoPreview`

Pure presentational. Props:

```ts
interface MultiRepoPreviewProps {
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
```

Renders the rail header, cards, mode toggle, and summary line.

## Failure handling

- **Worktree create fails for one repo** — surface the error on that repo's preview card (red border, error message, retry button). Other repos succeed independently. User can retry the failed repo or remove it from the selection and resubmit.
- **Session create fails (mode C)** — worktrees still succeed; session error shown inline. User retries session creation against the existing worktree.
- **All worktrees succeed but session group create fails** — degrade gracefully: sessions exist ungrouped, error toast prompts the user to group manually.
- **Branch input is empty** — submit disabled. Existing modal pattern.
- **Branch resolution lookup fails for one repo** — the preview card shows `?` for the resolution badge but does not block submit; the actual worktree create will surface the real error.

## Testing

- Backend: unit tests on `git:addWorktreeBatch` covering all-success, partial-failure, all-failure cases. Use the existing test git repos in `tests/fixtures/`.
- Backend: unit tests on `resolveBranchAcrossRepos` covering local-only, remote-only, neither, mixed.
- Frontend: component tests on `MultiRepoPreview` for the four state matrices (mode B/C × all-resolved/has-errors).
- Frontend: integration test on the modal — multi-select → submit → assert N worktree IPC calls + correct session/group calls.
- Manual: run through the mockup interaction flows in the live app and verify parity.

## PR split

Estimated total: ~600-700 lines. Split into two sequential PRs to keep each reviewable:

**PR 1 — Backend (~250 lines):**
- `gitService.resolveBranchAcrossRepos` helper.
- `git:addWorktreeBatch` IPC handler.
- Per-repo result type wired through preload + renderer API surface.
- Unit tests for both helpers.

**PR 2 — Frontend (~400 lines):**
- `MultiRepoPreview` subcomponent.
- `NewSessionModal` multi-select state + layout transition + submit routing.
- Component tests.

PR 1 ships behind the existing single-repo flow (no UI surface yet) so it can land independently without user-visible churn. PR 2 wires up the UI.

## Out of scope (future)

- Saved repo bundles ("Salary stack" → `[Salary, Core, Web]`).
- Recently-used repo combos surfaced as a "Resume task" row.
- Per-repo branch overrides.
- Cross-host repo sets.
- A first-class `Task` entity that owns sessions.
