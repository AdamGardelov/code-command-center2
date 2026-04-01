# Worktree Sync Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After creating a git worktree, automatically copy configurable files/directories (like `.claude/`, `CLAUDE.md`) from the source repo into the new worktree.

**Architecture:** Add `worktreeSyncPaths` to `CccConfig`, extend `GitService.addWorktree()` to copy paths after worktree creation (local via `fs.cpSync`, remote via SSH `cp -r`), and add a UI editor in SettingsModal's worktrees tab.

**Tech Stack:** Node.js `fs` APIs, existing SSH service, React/Zustand for UI

---

### File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/shared/types.ts:130-150` | Add `worktreeSyncPaths` to `CccConfig` |
| Modify | `src/main/config-service.ts:8-25` | Add default, parse, and update for new field |
| Modify | `src/main/git-service.ts:68-87` | Copy sync paths after worktree creation |
| Modify | `src/renderer/stores/session-store.ts` | Add `worktreeSyncPaths` to store + hydration |
| Modify | `src/renderer/components/SettingsModal.tsx:799-821` | Add sync paths editor in worktrees tab |

---

### Task 1: Add `worktreeSyncPaths` to types and config

**Files:**
- Modify: `src/shared/types.ts:130-150`
- Modify: `src/main/config-service.ts:8-25, 38-83, 106-133`

- [ ] **Step 1: Add field to `CccConfig` interface**

In `src/shared/types.ts`, add to the `CccConfig` interface (after `worktreeBasePath`):

```typescript
worktreeSyncPaths: string[]
```

- [ ] **Step 2: Add default value in `DEFAULT_CONFIG`**

In `src/main/config-service.ts`, add to `DEFAULT_CONFIG` (after `worktreeBasePath`):

```typescript
worktreeSyncPaths: ['.claude', 'CLAUDE.md'],
```

- [ ] **Step 3: Add parsing in `load()`**

In `src/main/config-service.ts`, inside the `load()` method's config parsing block (after the `worktreeBasePath` line ~50), add:

```typescript
worktreeSyncPaths: Array.isArray(parsed.worktreeSyncPaths) ? parsed.worktreeSyncPaths : ['.claude', 'CLAUDE.md'],
```

- [ ] **Step 4: Add update handling in `update()`**

In `src/main/config-service.ts`, inside the `update()` method (after the `worktreeBasePath` line ~118), add:

```typescript
if (partial.worktreeSyncPaths !== undefined) this.config.worktreeSyncPaths = partial.worktreeSyncPaths
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm typecheck:node`
Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/config-service.ts
git commit -m "feat: add worktreeSyncPaths config field with defaults"
```

---

### Task 2: Copy sync paths after worktree creation

**Files:**
- Modify: `src/main/git-service.ts:1-2, 68-87`

- [ ] **Step 1: Add fs imports to git-service.ts**

At the top of `src/main/git-service.ts`, add to the imports:

```typescript
import { existsSync, statSync, cpSync, mkdirSync } from 'fs'
import { basename, dirname, join } from 'path'
```

(Replace the existing `import { basename } from 'path'` line.)

- [ ] **Step 2: Add private `syncPaths` method**

Add this method to the `GitService` class, before `listWorktrees`:

```typescript
private syncPaths(repoPath: string, worktreePath: string, remoteHost?: string): void {
  const paths = this.configService?.get().worktreeSyncPaths ?? []
  if (paths.length === 0) return

  for (const syncPath of paths) {
    if (remoteHost && this.sshService) {
      const hostConfig = this.configService?.get().remoteHosts?.find(h => h.name === remoteHost)
      const sshHost = hostConfig?.host ?? remoteHost
      this.sshService.exec(sshHost, `test -e '${repoPath}/${syncPath}' && mkdir -p '${worktreePath}/${dirname(syncPath)}' && cp -r '${repoPath}/${syncPath}' '${worktreePath}/${syncPath}'`)
      continue
    }

    const src = join(repoPath, syncPath)
    const dest = join(worktreePath, syncPath)
    try {
      if (!existsSync(src)) continue
      mkdirSync(dirname(dest), { recursive: true })
      cpSync(src, dest, { recursive: statSync(src).isDirectory() })
    } catch (err) {
      console.warn(`Failed to sync ${syncPath} to worktree:`, err)
    }
  }
}
```

- [ ] **Step 3: Call `syncPaths` in `addWorktree`**

In the `addWorktree` method, add the call right before the `return` statement (after the error check on line ~78):

```typescript
this.syncPaths(expanded, expandedTarget, remoteHost)
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm typecheck:node`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/git-service.ts
git commit -m "feat: copy configured sync paths after worktree creation"
```

---

### Task 3: Add sync paths to Zustand store

**Files:**
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add `worktreeSyncPaths` to store state and default**

In `src/renderer/stores/session-store.ts`, add `worktreeSyncPaths: string[]` to the store interface (after `worktreeBasePath`) and set the default:

```typescript
worktreeSyncPaths: ['.claude', 'CLAUDE.md'],
```

- [ ] **Step 2: Add hydration from config**

In the config hydration block (where `worktreeBasePath` is set from config, around line 103), add:

```typescript
worktreeSyncPaths: config.worktreeSyncPaths ?? ['.claude', 'CLAUDE.md'],
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck:web`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/session-store.ts
git commit -m "feat: add worktreeSyncPaths to Zustand store"
```

---

### Task 4: Add sync paths editor in SettingsModal

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx:799-821`

- [ ] **Step 1: Read `worktreeSyncPaths` from store**

Near the top of the `SettingsModal` component (after the `worktreeBasePath` selector around line 21), add:

```typescript
const worktreeSyncPaths = useSessionStore((s) => s.worktreeSyncPaths)
```

- [ ] **Step 2: Add the sync paths editor in the worktrees tab**

In the worktrees tab section, after the closing `</div>` of the "Default Worktree Base Path" block (after line 819), add a new block before the tab's closing `</div>`:

```tsx
<div>
  <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
    Sync Paths
  </label>
  <textarea
    defaultValue={worktreeSyncPaths.join('\n')}
    onBlur={(e) => {
      const paths = e.target.value.split('\n').map(p => p.trim()).filter(Boolean)
      void window.cccAPI.config.update({ worktreeSyncPaths: paths })
      useSessionStore.setState({ worktreeSyncPaths: paths })
    }}
    rows={4}
    placeholder={".claude\nCLAUDE.md"}
    className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)] font-mono"
    style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)', resize: 'vertical' }}
  />
  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
    Files and folders to copy from the source repo into new worktrees (one per line)
  </p>
</div>
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev`
1. Open Settings → Worktrees tab
2. Verify the "Sync Paths" textarea shows `.claude` and `CLAUDE.md` on separate lines
3. Edit the list, blur out, reopen settings — verify it persists

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add sync paths editor to worktrees settings tab"
```

---

### Task 5: End-to-end smoke test

- [ ] **Step 1: Test local worktree creation with sync**

1. Run `pnpm dev`
2. Open a project that has a `.claude/` directory and `CLAUDE.md`
3. Create a new worktree via the UI
4. Verify the new worktree directory contains copies of `.claude/` and `CLAUDE.md`

- [ ] **Step 2: Test with missing source paths**

1. Open a project that does NOT have `.claude/` or `CLAUDE.md`
2. Create a worktree
3. Verify it succeeds without errors (paths are silently skipped)

- [ ] **Step 3: Test empty sync paths config**

1. Go to Settings → Worktrees, clear the sync paths textarea
2. Create a worktree
3. Verify no files are copied and no errors occur
