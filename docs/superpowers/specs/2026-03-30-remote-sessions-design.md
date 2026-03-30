# CCC2 Remote Sessions — Design Spec

## Overview

Add SSH-based remote session management. Users configure remote hosts in settings, create sessions on remote machines, and interact with them as if they were local. Sessions run in tmux on the remote, rendered via node-pty + xterm.js locally. SSH ControlMaster pools connections for performance.

## Remote Host Config

Added to `~/.ccc/config.json` and `CccConfig`:

```json
{
  "remoteHosts": [
    {
      "name": "WORK-SERVER",
      "host": "adam@work.example.com",
      "favoriteFolders": [
        { "name": "Backend", "path": "~/projects/backend", "defaultBranch": "main" }
      ]
    }
  ]
}
```

### Types

```typescript
interface RemoteHost {
  name: string            // Display name (e.g. "WORK-SERVER")
  host: string            // SSH host string (e.g. "adam@server.com")
  favoriteFolders: FavoriteFolder[]
}
```

Add `remoteHosts: RemoteHost[]` to `CccConfig`.
Add `remoteHost?: string` to `Session` (the host name, undefined = local).
Add `remoteHost?: string` to `SessionCreate`.

## Architecture

### SshService (`src/main/ssh-service.ts`)

Executes commands on remote hosts via SSH with ControlMaster connection pooling.

```typescript
class SshService {
  // Run a command on remote host, return stdout
  exec(host: string, command: string): string | null

  // Check if host is reachable (timeout 3s)
  isOnline(host: string): boolean

  // Start ControlMaster background connection
  startControlMaster(host: string): void

  // Stop ControlMaster
  stopControlMaster(host: string): void

  // Stop all
  stopAll(): void
}
```

SSH options for all commands:
```
-o ControlMaster=auto
-o ControlPath=~/.ccc/ssh-%r@%h:%p
-o ControlPersist=300
-o ConnectTimeout=5
-o BatchMode=yes
```

`BatchMode=yes` prevents password prompts — requires SSH key auth.

### Session Lifecycle (Remote)

Same as local but all tmux commands run via SSH:

```
Create  → ssh host tmux new-session -d -s ccc-name -c dir -- claude
Attach  → node-pty spawns: ssh -t host tmux attach -d -t ccc-name
Detach  → kill PTY (SSH disconnects, tmux lives on)
Kill    → ssh host tmux kill-session -t ccc-name
List    → ssh host tmux list-sessions -F "..."
```

### SessionManager Changes

SessionManager gets a `setSshService(ssh)` method. When creating/listing/killing sessions with a `remoteHost`, it delegates tmux commands to SshService instead of local execFileSync.

The `list()` method iterates all configured remote hosts and merges results. Each discovered session gets tagged with `remoteHost: hostName`.

### PtyManager Changes

`attach(sessionId, tmuxName, remoteHost?)` — if `remoteHost` is set, spawns:
```
ssh -t host tmux attach -d -t tmuxName
```
instead of local `tmux attach`.

SSH options for attach include ControlMaster settings for connection reuse.

### Online/Offline Detection

- On startup: check each host with `ssh -o ConnectTimeout=3 host true`
- Every 10 seconds: re-check offline hosts (not online ones — no need to spam working connections)
- Store per-host online status in a Map
- Emit `host:status-changed` to renderer when status changes

### Config Changes

`CccConfig` adds:
```typescript
remoteHosts: RemoteHost[]
```

`ConfigService` handles loading/saving `remoteHosts` array.

## UI Changes

### Sidebar — Machine Headers

Sessions grouped under machine headers when remote hosts exist:

```
▸ Local                          3
    [session cards...]
▸ WORK-SERVER                    2
    [session cards...]
▾ DEV-BOX                 offline
    [greyed out cards...]
```

- Machine headers are collapsible (like categories)
- Remote headers show online/offline badge
- Offline sessions are greyed out (muted text, no status)
- Reconnect happens automatically — no manual button needed (simplify)

When no remote hosts are configured, no machine headers shown (current behavior).

### SessionCard — Remote Indicator

Remote session cards show a small `↗` icon or the host name in muted text.

### NewSessionModal — Host Selection

When remote hosts exist, add "Where" selector above Type:

```
WHERE
[Local] [WORK-SERVER] [DEV-BOX]

TYPE
[Claude] [Gemini] [Shell]
```

Selecting a remote host shows that host's favorites instead of local favorites.

### Settings — Remote Hosts Tab

New tab "Remote Hosts" in SettingsModal:
- List of configured hosts (name, SSH host string)
- Add/edit/delete with inline form
- Per-host favorite folders (reuse existing favorites UI pattern)
- Connection test button ("Test" → shows online/offline)

## IPC Changes

```typescript
// New channels
'host:check' (hostName: string) → boolean              // Check if host is online
'host:status' () → Record<string, boolean>              // All host statuses

// Modified
'session:create' now accepts remoteHost in SessionCreate
'session:list' returns sessions from all hosts (local + remote)
```

Preload `CccAPI` additions:
```typescript
host: {
  check: (name: string) => Promise<boolean>
  statuses: () => Promise<Record<string, boolean>>
  onStatusChanged: (cb: (name: string, online: boolean) => void) => () => void
}
```

## Store Changes

```typescript
// New state
hostStatuses: Record<string, boolean>  // host name → online

// New actions
loadHostStatuses: () => Promise<void>
updateHostStatus: (name: string, online: boolean) => void
```

## File Map

```
src/
├── main/
│   ├── ssh-service.ts              # New: SSH command execution + ControlMaster
│   ├── session-manager.ts          # Modified: remote tmux via SshService
│   ├── pty-manager.ts              # Modified: remote attach via SSH
│   ├── ipc/
│   │   ├── session.ts              # Modified: pass remoteHost
│   │   └── host.ts                 # New: host status IPC
│   └── index.ts                    # Modified: init SshService, register host IPC
├── preload/
│   └── index.ts                    # Modified: add host API
├── renderer/
│   ├── components/
│   │   ├── SessionSidebar.tsx      # Modified: machine headers, grouping
│   │   ├── SessionCard.tsx         # Modified: remote indicator
│   │   ├── NewSessionModal.tsx     # Modified: host selector
│   │   └── SettingsModal.tsx       # Modified: remote hosts tab
│   └── stores/
│       └── session-store.ts        # Modified: hostStatuses, remote config
└── shared/
    └── types.ts                    # Modified: RemoteHost, Session.remoteHost
```

## What's NOT in Scope

- SSH key management / setup wizard
- SSH agent forwarding
- Remote worktree creation
- Port forwarding / tunneling
- Multiple simultaneous SSH connections to same host (ControlMaster handles this)
