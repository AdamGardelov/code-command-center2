# CCC2 Batch A Features — Design Spec

## Overview

Port four features from CCC1 to CCC2: Claude config routing, skip permissions, session exclusion, and IDE integration. All share a new "Advanced" Settings tab and require minimal UI work.

## Scope

**In scope:** Claude config routing with Settings UI, global skip permissions toggle, session exclusion (hide/show), IDE integration (open working dir in editor).

**Out of scope:** Per-session skip permissions prompt, remote IDE integration, keybindings (Batch B).

---

## 1. Claude Config Routing

### Types

```typescript
interface ClaudeConfigRoute {
  pathPrefix: string   // e.g. "~/Dev/ProjectA"
  configDir: string    // e.g. "~/.claude-project-a"
}
```

### Config Changes

```typescript
// New fields in CccConfig
claudeConfigRoutes: ClaudeConfigRoute[]  // ordered, first match wins
defaultClaudeConfigDir?: string          // fallback; undefined = don't set env var
```

### Backend

`ConfigService.resolveClaudeConfigDir(workingDirectory: string): string | undefined`
- Iterates `claudeConfigRoutes` in order
- First route where `workingDirectory` starts with expanded `pathPrefix` wins
- Falls back to `defaultClaudeConfigDir` if set
- Returns `undefined` if no match and no default (= don't set CLAUDE_CONFIG_DIR)

`SessionManager.create()`:
- Calls `resolveClaudeConfigDir(opts.workingDirectory)`
- If result is defined, passes `-e CLAUDE_CONFIG_DIR={resolved}` to `tmux new-session`

### UI

Settings > Advanced tab:
- List of routes (path prefix + config dir) with edit/delete, same pattern as Favorites
- Add button at bottom
- Text field for `defaultClaudeConfigDir` below the list

---

## 2. Skip Permissions / Yolo Mode

### Config Changes

```typescript
// New field in CccConfig
dangerouslySkipPermissions: boolean  // default: false
```

### Session Type Changes

```typescript
// New field on Session
skipPermissions?: boolean  // frozen at creation time
```

### Backend

`SessionManager.create()`:
- When `type === 'claude'` and `configService.get().dangerouslySkipPermissions === true`:
  - Append `--dangerously-skip-permissions` to the claude command
  - Set `session.skipPermissions = true`

### UI

Settings > Advanced tab:
- Toggle: "Skip Permissions" with warning text
- Label: "Automatically pass --dangerously-skip-permissions to new Claude sessions"

SessionCard:
- If `session.skipPermissions === true`, show a visual indicator (e.g. Zap icon from lucide-react, yellow/warning color)

---

## 3. Session Exclusion

### Config Changes

```typescript
// New field in CccConfig
excludedSessions: string[]  // session names
```

### Session Type Changes

```typescript
// Computed field on Session (not persisted in session, derived from config)
isExcluded: boolean
```

### Backend

`ConfigService.toggleExcluded(sessionName: string): void`
- If sessionName in `excludedSessions`, remove it; otherwise add it
- Calls `save()` after

### Store

`SessionStore.loadSessions()`:
- After fetching sessions, cross-reference with `excludedSessions` from config
- Set `isExcluded = true` on matching sessions

New action: `toggleExcluded(sessionId: string)`:
- Calls `config:toggle-excluded` IPC
- Updates local session state

### UI

SessionCard:
- If `isExcluded`: reduce opacity to ~40%, muted status colors

Sidebar header:
- Show "· N excluded" count when excludedSessions.length > 0

Grid view:
- Filter out excluded sessions entirely

Context menu (GroupContextMenu or new SessionContextMenu):
- Add "Exclude" / "Include" option

### IPC

`ipcMain.handle('config:toggle-excluded', (_, sessionName: string) => configService.toggleExcluded(sessionName))`

---

## 4. IDE Integration

### Config Changes

```typescript
// New field in CccConfig
ideCommand?: string  // e.g. "code", "cursor", "rider"
```

### Backend

`SessionManager.openInIde(sessionId: string): void`
- Looks up session by ID
- If remote: throw error "IDE integration not supported for remote sessions"
- If `ideCommand` not configured: throw error "IDE command not configured"
- Spawns: `child_process.spawn(ideCommand, [workingDirectory], { detached: true, stdio: 'ignore' })` and unrefs

### IPC

`ipcMain.handle('session:open-ide', (_, id: string) => sessionManager.openInIde(id))`

### Preload

Add `openInIde(id: string): Promise<void>` to `session` namespace in cccAPI.

### UI

Settings > Advanced tab:
- Text field: "IDE Command" with placeholder "code"

Context menu on SessionCard:
- "Open in IDE" option
- Disabled if: ideCommand not set, or session is remote

---

## Settings > Advanced Tab

New tab added to SettingsModal alongside existing tabs (providers, favorites, appearance, remotes, worktrees).

Sections in order:
1. **IDE Command** — single text input
2. **Skip Permissions** — toggle with warning
3. **Claude Config Routing** — default config dir field + route list with add/edit/delete
