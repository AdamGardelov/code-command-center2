# Bunker Container Support Design Spec

**Date:** 2026-04-28
**Status:** Approved

## Problem

CCC2 supports running tmux sessions inside Docker containers (`enableContainers` feature), but assumes the container's working directory paths mirror the host (typical bind-mount setup). The new Wint Sandbox Bunker container is hermetic by design: repos are cloned **inside** the container under `/repos/<name>` rather than mounted from the host, the AI agents stay inside, and host-side gh/git push goes through a gateway sidecar. Today's container session model breaks against the bunker because:

- The working-directory picker offers host paths that don't exist inside the container
- Worktree creation runs on the host filesystem, not inside the container
- State-detection hooks write to `~/.ccc/states/` inside the container, invisible to host CCC
- PR polling assumes host's `gh` can reach the same repo that the session sees

## Solution

Extend the existing container model with two new opt-in fields on `ContainerConfig` that signal "this container has its own internal repo layout." Sessions targeting such containers use container-internal paths throughout, discover repos via `docker exec`, create worktrees inside the container, fall back to OSC-only state detection, and skip PR polling. No new top-level entity, no auto-detection by name, no Wint-specific naming.

## Mechanism

A container becomes a "bunker-style" container when `containerInternalPaths` is `true` on its config. That single flag changes three behaviors: working-directory discovery, worktree backend, and state-detection effective source. `worktreeBaseDir` then says where to put worktrees inside the container. Both fields are user-configured per container in Settings; CCC does not auto-detect or sniff bunker layouts.

## Data Model

### ContainerConfig

```typescript
interface ContainerConfig {
  name: string
  remoteHost?: string
  // NEW
  containerInternalPaths?: boolean   // default false (= today's host-mounted behavior)
  worktreeBaseDir?: string           // only meaningful when containerInternalPaths=true
}
```

### Session

`Session.workingDirectory` stays a plain string. When `containerInternalPaths=true` it holds container-internal paths (e.g., `/repos/Core`) instead of host paths. The type is unchanged; only the data shape differs by container.

## Repo Discovery (NewSessionModal)

When the user picks a container with `containerInternalPaths=true`:

- The host folder picker is hidden
- A repo dropdown appears, populated by `docker exec <container> ls -1 /repos`
- The result is cached in `ContainerService` alongside the existing 30-second TTL cache
- Selecting an entry sets `workingDirectory = /repos/<repoName>`

We do not client-side-validate that the entry is a git repo. The bunker launcher owns what is cloned into `/repos`. If the user picks a non-repo folder, the first git operation will fail with the existing error UI — acceptable edge case for v1.

For remote-host bunkers (`remoteHost` set on the container), the discovery command runs through `SshService.exec` exactly as today's container running-state checks do.

## Worktrees

`git-service.ts` already has explicit mode dispatch for worktree creation (commit `0967397`). Today's modes are `local` and `ssh`. A new mode `docker-exec` is added, used whenever the target container has `containerInternalPaths=true`.

Layout convention matches host worktrees (commit `f873a75`): `<worktreeBaseDir>/<branch>/<repo>`.

Example with `worktreeBaseDir = /repos/worktrees`, branch `feature/foo`, repo `Core`:

```
docker exec <container> git -C /repos/Core worktree add /repos/worktrees/feature/foo/Core feature/foo
```

The full worktree surface (create, list, remove, branch listing, branch metadata, fetch remotes) gets a docker-exec backend mirroring the existing local and SSH backends. Bunker sessions use containers' git binary throughout — never host's.

## State Detection

For sessions where the target container has `containerInternalPaths=true`:

- `OscParser` works unchanged — terminal output flows through the same PTY regardless of `docker exec`, so OSC 9 progress and OSC 0 title sequences are received as normal
- `StateDetector` is not modified. It will simply never see hook-state files for bunker sessions, because hooks inside the container write to container-`~/.ccc/states/` (invisible to host)
- Net effect: bunker sessions are driven exclusively by OSC

This is a deliberate single-source state for bunker sessions. Removing the host-side hook detector entirely is a separate decision out of scope for this spec.

## PR Display

No work needed. CCC has no per-session PR badges today — `pr-service.ts` polls GitHub at the org level for pinned repos, and PRs are surfaced in their own sidebar (`PrSidebar`), not coupled to local session cards. Bunker sessions therefore neither gain nor lose PR display. PrSidebar's worktree-creation continues to write to host folders only; extending it to create worktrees inside a chosen bunker is out of scope for v1.

This was discovered during plan self-review — the original Q6 in brainstorming asked about "PR badges on sessions" as if they existed, which they do not.

## Settings UI

`ContainersSettings.tsx` per-container row gets two new controls:

- Toggle: **"Repos live inside container"** — binds to `containerInternalPaths`
- Text field (rendered only when toggle is on): **"Worktree folder"** with placeholder `/repos/worktrees`, binds to `worktreeBaseDir`

No "Add Bunker" button, no pre-configured templates. The user enters the container name (e.g., `wint-sandbox-bunker-main`), flips the toggle, types the worktree path. Multiple bunker instances appear as separate container rows with no special grouping.

## Edge Cases

- **Container not running** at session create — already validated by `ContainerService.isRunning()`. Same flow.
- **`/repos` doesn't exist in container** — `docker exec ls /repos` returns non-zero. NewSessionModal shows "No repos found in container at /repos" and disables the create button.
- **Worktree base path missing or read-only** — `git worktree add` via docker-exec fails. Surfaced through the existing worktree error UI.
- **Toggle flipped on an existing container that has active sessions** — sessions keep their existing `workingDirectory` strings unchanged; only new sessions use the new path mode. Acceptable since users who flip the toggle understand they're reconfiguring.
- **`worktreeBaseDir` empty when toggle is on** — Settings validation requires a non-empty value. Worktree UI is disabled if missing.

## Out of Scope (v1)

- Auto-discovery of bunker instances from SandboxBunker's `instances.json`
- Pre-filling defaults from bunker conventions or remote endpoints
- PR badges / GitHub state for bunker sessions
- File-transfer integration with bunker dashboard's `~/inbox`
- Extending `PrSidebar` worktree-creation to target a bunker container
- Group concept in sidebar ("Bunker: main", "Bunker: support")
- Surfacing the bunker dashboard URL or a launch link inside CCC
- A separate "Bunker" type or any Wint-specific naming in CCC code

## Estimated Size

Approximately 300–400 LOC of production code across roughly 6–8 files: `ContainerConfig` type + Settings UI row + NewSessionModal repo dropdown + git-service docker-exec dispatch (six methods) + repo-discovery in ContainerService. PR-service is untouched.
