# Container Sessions Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Problem

CCC2 manages tmux sessions locally and on remote hosts via SSH, but has no way to run sessions inside Docker containers. Users working with dev containers need to manually attach and manage these sessions outside CCC2.

## Solution

Add opt-in container session support behind a feature flag. Tmux remains on the host; the session command is wrapped with `docker exec` to run inside the container. Supports both local and remote (SSH-tunneled) containers.

## Feature Flag

- Config field: `enableContainers: boolean` (default `false`)
- When off: no container UI visible, no container behavior
- When on + containers configured + running: container is **pre-selected by default** during session creation

## Data Model

### ContainerConfig

```typescript
interface ContainerConfig {
  name: string           // Docker container name
  label?: string         // Display name (fallback to name)
  remoteHost?: string    // Bind to specific remote host (undefined = local)
}
```

### Session extensions

```typescript
// Added to existing Session interface
isContainer?: boolean
containerName?: string
```

### CccConfig extensions

```typescript
// Added to existing CccConfig interface
containers: ContainerConfig[]
containerSessions: Record<string, string>  // sessionName → containerName
enableContainers: boolean                  // feature flag, default false
```

## ContainerService

New file: `src/main/container-service.ts`

### isRunning(containerName: string, remoteHost?: string): boolean

- Executes `docker inspect --format={{.State.Running}} <containerName>`
- Remote: tunnels command through existing SSH service
- 30-second TTL cache per container to avoid Docker daemon spam
- Returns `false` on any error (container missing, Docker not installed, timeout, etc.)

### listRunning(containers: ContainerConfig[]): ContainerConfig[]

- Filters configured containers against `isRunning()`
- Groups checks by remote host for efficiency
- Used by session creation flow to determine available containers

## Session Creation Flow

1. User picks session name, working directory, and type (unchanged)
2. **New step** — if `enableContainers` is true and containers are configured for the target host (local or current remote):
   - Call `ContainerService.listRunning()` for matching containers
   - If 1+ containers running → container is **pre-selected** (default ON), user can deselect to run locally
   - If multiple running → dropdown to pick which container
   - If none running → skip step, create session as normal
3. `SessionManager.create()` receives optional `containerName`
4. Tmux session command is wrapped:
   ```bash
   docker exec -it -e CCC_SESSION_NAME=<name> -w <path> <container> zsh -lic claude
   ```
5. For remote containers (via SSH):
   ```bash
   ssh -t <host> 'docker exec -it -e CCC_SESSION_NAME=<name> -w <path> <container> zsh -lic claude'
   ```
6. `ConfigService` persists the mapping in `containerSessions`

### PTY Handling

No changes to `PtyManager`. Tmux runs on the host as today — the PTY attaches to the tmux session normally. Only the command running *inside* the tmux session executes in the container.

### Environment Variables

- `CCC_SESSION_NAME`: passed via `docker exec -e` (not tmux `-e`)
- Working directory: passed via `docker exec -w` (tmux working directory set to `$HOME` since the real path is inside the container)

## Visual Indicator

### CSS Variables

```css
/* Dark theme */
--container: #7ec8c8;

/* Light theme */
--container: #0d7377;
```

### SessionCard

- Lucide `Box` icon in `var(--container)` color, positioned after session name (same pattern as `Zap` icon for skipPermissions)
- Text badge with container name, styled like the remote host badge but with teal-toned background

### SessionTopBar

- `Box` icon + container name badge, positioned after remote host badge (if present)

### GridView

- `Box` icon only in card header (space constrained)

## Settings UI

New **"Containers"** section in SettingsModal:

### Feature Flag Toggle

- "Enable container sessions" — toggles `enableContainers`
- When off: container list is hidden

### Container List (visible when flag is on)

Each row displays:
- `name` — Docker container name
- `label` — editable display name (optional, defaults to name)
- `remoteHost` — dropdown: "Local" + all configured remote hosts
- Delete button

### Add Container Flow

- Name input (required)
- Label input (optional)
- Remote host dropdown (default: Local)

Follows the same interaction pattern as the remote hosts section.

## Out of Scope

- Auto-starting stopped containers
- Container image management or building
- Per-session-group container defaults
- Container health monitoring beyond `isRunning()`
- Docker Compose integration
- Devcontainer spec parsing
