# CCC2 Git & Workflows — Design Spec

## Overview

Add worktree management and session groups to CCC2. Users can create git worktrees from the UI, and sessions are automatically grouped by repo. Manual groups are also supported. Worktree paths are configurable globally, per-host, and per-repo.

## Scope

**In scope:** Worktree management (create/list/remove), session groups (auto + manual), configurable worktree paths, branch listing/selection.

**Out of scope:** Diff view, PR review, IDE integration, git status tracking (staged/unstaged), git commit/push/pull via UI.

## Config Changes

### New fields in `~/.ccc/config.json`

```json
{
  "worktreeBasePath": "~/worktrees",
  "favoriteFolders": [
    {
      "name": "Core",
      "path": "~/Dev/Wint/Core",
      "defaultBranch": "main",
      "worktreePath": "~/Dev/worktrees/Core"
    }
  ],
  "remoteHosts": [
    {
      "name": "WORK-SERVER",
      "host": "adam@work.example.com",
      "worktreeBasePath": "~/worktrees",
      "favoriteFolders": [
        { "name": "Backend", "path": "~/projects/backend", "defaultBranch": "main", "worktreePath": "~/worktrees/backend" }
      ]
    }
  ],
  "sessionGroups": [
    {
      "id": "grp-1",
      "name": "feature-auth",
      "sessionIds": ["sess-1", "sess-2"]
    }
  ]
}
```

### Types

```typescript
// FavoriteFolder additions
interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
  worktreePath?: string  // Per-repo worktree path override
}

// RemoteHost additions
interface RemoteHost {
  name: string
  host: string
  worktreeBasePath?: string  // Per-host default
  favoriteFolders: FavoriteFolder[]
}

// CccConfig additions
interface CccConfig {
  // ...existing
  worktreeBasePath: string
  sessionGroups: SessionGroup[]
}

// New types
interface SessionGroup {
  id: string
  name: string
  sessionIds: string[]
}

interface Worktree {
  path: string
  branch: string
  isMain: boolean
  repoPath: string  // Main repo path
}
```

## Architecture

### GitService (`src/main/git-service.ts`)

New service handling all git operations. Follows the same pattern as SshService.

```typescript
class GitService {
  // Worktree operations
  listWorktrees(repoPath: string, remoteHost?: string): Worktree[]
  addWorktree(repoPath: string, branch: string, targetPath: string, remoteHost?: string): Worktree
  removeWorktree(worktreePath: string, remoteHost?: string): void

  // Branch info
  getBranch(dir: string, remoteHost?: string): string | null
  listBranches(repoPath: string, remoteHost?: string): string[]

  // Helpers
  resolveWorktreePath(repoPath: string, branch: string, config: CccConfig, remoteHost?: string): string
}
```

GitService receives SshService as a dependency for remote operations (same pattern as SessionManager).

**resolveWorktreePath logic:**
1. Check if repo has `worktreePath` in favorites → use it
2. Check if host (or global) has `worktreeBasePath` → use `{basePath}/{repoName}/{branch}`
3. Fallback: `{repoPath}/../{repoName}-worktrees/{branch}`

All commands run locally via `execFileSync` or via `SshService.exec()` for remote.

### Session Groups & Auto-Grouping

#### Automatic grouping

When sessions are listed, CCC detects which ones belong to the same repo by comparing `workingDirectory` against known worktrees.

**Logic in SessionManager:**
- On `list()`: for each session, check if `workingDirectory` is a worktree (via `git rev-parse --show-toplevel` + `git worktree list`)
- Cache repo→worktree mapping per repo (updated on worktree add/remove)
- Sessions in same repo but different worktrees → auto-group with repo name

#### Manual groups

Persisted in config as `sessionGroups[]`. Users can:
- Create a group (name it)
- Add/remove sessions from a group
- Delete a group (sessions remain, only grouping is removed)

#### Priority

Manual group wins over auto-group. If a session is manually grouped, it does not appear in the auto-group.

### Session type additions

```typescript
interface Session {
  // ...existing
  groupId?: string       // Manual group membership
  repoPath?: string      // Detected main repo (for auto-grouping)
}
```

## IPC Changes

### New channels

```typescript
// Git operations
'git:list-worktrees' (repoPath: string, remoteHost?: string) → Worktree[]
'git:add-worktree' (repoPath: string, branch: string, targetPath: string, remoteHost?: string) → Worktree
'git:remove-worktree' (worktreePath: string, remoteHost?: string) → void
'git:list-branches' (repoPath: string, remoteHost?: string) → string[]

// Groups
'group:create' (name: string) → SessionGroup
'group:delete' (groupId: string) → void
'group:add-session' (groupId: string, sessionId: string) → void
'group:remove-session' (groupId: string, sessionId: string) → void
```

### CccAPI additions

```typescript
interface CccAPI {
  // ...existing
  git: {
    listWorktrees: (repoPath: string, remoteHost?: string) => Promise<Worktree[]>
    addWorktree: (repoPath: string, branch: string, targetPath: string, remoteHost?: string) => Promise<Worktree>
    removeWorktree: (worktreePath: string, remoteHost?: string) => Promise<void>
    listBranches: (repoPath: string, remoteHost?: string) => Promise<string[]>
  }
  group: {
    create: (name: string) => Promise<SessionGroup>
    delete: (groupId: string) => Promise<void>
    addSession: (groupId: string, sessionId: string) => Promise<void>
    removeSession: (groupId: string, sessionId: string) => Promise<void>
  }
}
```

### Store additions

```typescript
// New state
sessionGroups: SessionGroup[]
autoGroups: Map<string, string[]>  // repoPath → sessionIds

// New actions
loadGroups: () => Promise<void>
createGroup: (name: string) => Promise<SessionGroup>
deleteGroup: (groupId: string) => Promise<void>
addSessionToGroup: (groupId: string, sessionId: string) => Promise<void>
removeSessionFromGroup: (groupId: string, sessionId: string) => Promise<void>
computeAutoGroups: () => void  // Computed from sessions + worktree info
```

## UI Changes

### Sidebar — Groups inside machine headers

```
▸ Local                              5
    ▸ feature-auth                   3
        [Core · main]
        [Core · feature-auth]
        [Shell · tests]
    [ungrouped session]
    [ungrouped session]
▸ WORK-SERVER                        2
    ▸ feature-auth                   1
        [Backend · feature-auth]
    [ungrouped session]
```

- Groups are collapsible, nested inside their machine header
- Auto-groups display repo name, manual groups display their chosen name
- A group can appear under multiple machines (if sessions span local + remote)
- Group headers show session count

### NewSessionModal — Worktree flow

Extends the existing modal with a "Worktree" option:

```
WHERE     [Local] [WORK-SERVER]
TYPE      [Claude] [Gemini] [Shell]
FROM      [Favorites ▾]    ← select repo

○ Open in repo
● New worktree
  BRANCH  [feature-auth    ]  ← autocomplete from branches
```

Selecting "New worktree" runs `git worktree add` and starts the session in the new worktree. "Open in repo" works as today.

### Context menu on sessions

- "Add to group..." → select existing group or create new
- "Remove from group"

### Settings — Worktree configuration

In existing Settings modal, per favorite:
- Field for `worktreePath` (override)

New global field (under Appearance or own section):
- `worktreeBasePath` — default path

Per remote host in Remote Hosts tab:
- `worktreeBasePath` — default for that host

## File Map

```
src/
├── main/
│   ├── git-service.ts              # New: worktree & branch operations
│   ├── session-manager.ts          # Modified: repoPath detection, auto-grouping
│   ├── config-service.ts           # Modified: worktreeBasePath, sessionGroups
│   ├── ipc/
│   │   ├── git.ts                  # New: git IPC handlers
│   │   └── group.ts               # New: group IPC handlers
│   └── index.ts                    # Modified: init GitService, register IPC
├── preload/
│   └── index.ts                    # Modified: git + group API
├── renderer/
│   ├── components/
│   │   ├── SessionSidebar.tsx      # Modified: group nesting inside machine headers
│   │   ├── SessionCard.tsx         # Modified: worktree indicator
│   │   ├── NewSessionModal.tsx     # Modified: worktree flow, branch selection
│   │   ├── SettingsModal.tsx       # Modified: worktreePath per favorite, basePath
│   │   └── GroupContextMenu.tsx    # New: right-click for group management
│   └── stores/
│       └── session-store.ts        # Modified: groups, autoGroups, worktree state
└── shared/
    └── types.ts                    # Modified: Worktree, SessionGroup, extended Session/Config
```

## What's NOT in Scope

- Diff view
- PR review
- IDE integration
- Git status tracking (staged/unstaged/conflicts)
- Git commit/push/pull operations via UI
