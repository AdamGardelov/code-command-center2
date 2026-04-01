# Worktree Sync Paths

## Problem

When creating a git worktree, `git worktree add` only checks out tracked files. Ignored files and directories (e.g. `.claude/`, `CLAUDE.md`) are not copied to the new worktree. These files are often essential for development tooling and need to be present in every worktree.

## Solution

After a successful `git worktree add`, copy a configurable list of paths from the source repo to the new worktree. Paths that don't exist in the source are silently skipped.

## Config

New field on `CccConfig`:

```typescript
worktreeSyncPaths: string[]
```

Default value: `[".claude", "CLAUDE.md"]`

Each entry is a relative path from the repo root. Can be a file or directory.

## Implementation

### `GitService.addWorktree()`

After the existing `git worktree add` succeeds, sync configured paths:

1. Read `worktreeSyncPaths` from config (via `this.configService`)
2. For each path in the list:
   - Construct source: `{repoPath}/{syncPath}`
   - Construct destination: `{worktreePath}/{syncPath}`
   - If source doesn't exist, skip
   - If source is a directory, copy recursively
   - If source is a file, copy it (creating parent dirs if needed)

### Local execution

Use Node.js `fs` APIs:
- `fs.existsSync()` to check source
- `fs.statSync()` to distinguish file vs directory
- `fs.cpSync(src, dest, { recursive: true })` for directories
- `fs.cpSync(src, dest)` for files
- `fs.mkdirSync(dirname(dest), { recursive: true })` to ensure parent dirs exist

### Remote/SSH execution

For remote worktrees, run shell commands via `sshService.exec()`:
- `test -e '{src}' && cp -r '{src}' '{dest}'` for each path
- Create parent dirs: `mkdir -p '{dirname(dest)}'`

### Error handling

- Missing source paths: skip silently (not all repos have all configured paths)
- Copy failure: log a warning but don't fail the worktree creation — the worktree itself was created successfully

## Settings UI

Add a field in `SettingsModal` under worktree settings where the user can edit the `worktreeSyncPaths` list. Simple text list editor — one path per line.
