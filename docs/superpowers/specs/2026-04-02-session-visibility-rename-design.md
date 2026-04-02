# Session Visibility & Rename Design Spec

## Overview

Three related improvements to session management UX:

1. **Archive** — move sessions to a collapsed "Archived" section in the sidebar, excluded from grid
2. **Exclude from grid** — clearer labeling for the existing feature (session stays visible in sidebar, hidden from grid)
3. **Display name rename** — cosmetic rename without touching the underlying tmux session

## Data Model Changes

### Config (`CccConfig` in `src/shared/types.ts`)

Add two new fields:

```typescript
archivedSessions: string[]                    // session names
sessionDisplayNames: Record<string, string>   // session name → display name
```

Existing `excludedSessions: string[]` stays as-is.

### Session Interface (`src/shared/types.ts`)

Add to the `Session` interface:

```typescript
isArchived?: boolean    // computed at load time, like isExcluded
displayName?: string    // from config, shown in UI instead of name
```

### State Relationships

- An archived session is implicitly excluded from grid (no need to also be in `excludedSessions`)
- Unarchiving a session does NOT add it to `excludedSessions` — it returns fully visible
- `excludedSessions` is only for non-archived sessions the user wants out of the grid
- A session can have a display name regardless of archive/exclude state

## Config Service Changes (`src/main/config-service.ts`)

### New Methods

```typescript
toggleArchived(sessionName: string): void
// Add/remove from archivedSessions array. If archiving, also remove from
// excludedSessions (archive supersedes exclude). Persist to disk.

setDisplayName(sessionName: string, displayName: string): void
// Set or update display name. If displayName is empty string, remove the
// entry (revert to session name). Persist to disk.

getDisplayName(sessionName: string): string | undefined
// Return display name if set, undefined otherwise.
```

### Default Config

Add defaults:

```typescript
archivedSessions: []
sessionDisplayNames: {}
```

## IPC Handlers (`src/main/ipc/config.ts`)

New handlers:

```
config:toggle-archived    — receives sessionName: string
config:set-display-name   — receives { sessionName: string, displayName: string }
```

## Preload API (`src/preload/index.ts`)

Expose new methods on `cccAPI`:

```typescript
toggleArchived(sessionName: string): Promise<void>
setDisplayName(sessionName: string, displayName: string): Promise<void>
```

## Store Changes (`src/renderer/stores/session-store.ts`)

### New State

```typescript
archivedSessions: string[]
```

### Load Sessions

When loading sessions, compute both `isExcluded` and `isArchived` from config arrays. Also apply `displayName` from `sessionDisplayNames` config.

A session is effectively excluded from grid if `isExcluded || isArchived`.

### New Actions

```typescript
toggleArchived(sessionId: string): void
// Convert ID to name, call IPC, update local state.
// If archiving: remove from excludedSessions locally (archive supersedes).

setDisplayName(sessionId: string, displayName: string): void
// Call IPC, update session in local state.
```

### Load Config

Load `archivedSessions` alongside `excludedSessions` from config.

## UI Changes

### Context Menu (`GroupContextMenu.tsx`)

Replace the current flat "Exclude session" / "Include session" button with structured sections:

```
Rename...
──────────
☐ Exclude from grid       ← checkmark toggle (checked when excluded)
Archive / Unarchive        ← label depends on current state
──────────
Mute notifications
Move to group        ▸
Open folder
Open in IDE
```

- **Rename...** at top, separated by divider
- **Exclude from grid** shows a checkmark (✓) when active, acts as toggle
- When session is archived, "Exclude from grid" is disabled (archive implies exclusion)
- **Archive** label changes to **Unarchive** when session is archived
- Dividers separate visibility controls from other actions

### Inline Rename

When "Rename..." is clicked from context menu:

1. The session card's name label becomes an `<input>` element
2. Pre-filled with current display name (or session name if no display name)
3. Text is selected on focus for easy replacement
4. **Enter** confirms — calls `setDisplayName` with new value
5. **Escape** cancels — reverts to original text
6. **Blur** (clicking away) confirms, same as Enter
7. Empty input clears display name (reverts to session name)

State tracked via `renamingSessionId: string | null` in the store or local component state.

### Session Card (`SessionCard.tsx`)

- Display `session.displayName || session.name` as the visible name
- When `renamingSessionId` matches this session, render inline input instead of label
- Archived sessions: same dimmed opacity (0.4) as currently excluded sessions

### Sidebar (`SessionSidebar.tsx`)

#### Session Grouping

Sessions are split into two groups:

1. **Active sessions** — rendered in existing group logic (by type or by machine)
2. **Archived sessions** — rendered in a collapsible "Archived" section at the bottom

#### Archived Section

```
▸ Archived (2)
```

- Collapsed by default
- Click header to expand/collapse
- Collapse state persisted in local component state (not config — ephemeral)
- When expanded, shows archived sessions with dimmed styling
- Count badge shows number of archived sessions
- If no archived sessions, the section is hidden entirely

#### Footer

Update footer text to reflect both counts:

```
3 sessions · 1 excluded · 2 archived
```

Only show counts that are > 0.

### Grid View (`GridView.tsx`)

Filter logic changes from:

```typescript
sessions.filter((s) => !s.isExcluded)
```

to:

```typescript
sessions.filter((s) => !s.isExcluded && !s.isArchived)
```

### Display Name in Grid Tiles

Grid terminal tiles should show `displayName || name` wherever the session name appears.

## Migration

No migration needed. New config fields default to empty array/object. Existing `excludedSessions` continues to work as before.

## Edge Cases

- **Session killed while archived**: Archived session disappears from session list naturally (tmux session gone). Entry stays in `archivedSessions` config but is inert — cleaned up lazily or ignored.
- **Rename to existing display name**: Allowed. Display names don't need to be unique (they're cosmetic).
- **Rename while session is archived**: Allowed. Display name is independent of visibility state.
- **Archive + exclude overlap**: If a session is in both `archivedSessions` and `excludedSessions`, archive takes precedence visually. `toggleArchived` removes from `excludedSessions` when archiving (archive supersedes). On unarchive, session returns fully visible (not re-added to `excludedSessions`).
