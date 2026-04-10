# PR Worktree Review

Create a worktree for a PR's branch directly from the PR sidebar, then auto-launch a review session in it.

## Context Menu

Right-clicking a PR row opens a context menu:

```
Open in browser
Copy PR URL
─────────────
Review in worktree  ▸  Claude
                       Gemini
                       Codex
                       Shell
```

- **Open in browser** — current left-click behavior, also available here
- **Copy PR URL** — copies `pr.url` to clipboard
- **Review in worktree** — submenu listing all enabled providers from `config.enabledProviders`
- Left-click on PR row continues to open in browser (unchanged)

### Context Menu Component

New `PrContextMenu` component rendered inside `PrSidebar`. Positioned at right-click coordinates via `onContextMenu` on each `PrRow`. Closes on click-outside, Escape, or scroll. Submenu appears on hover over "Review in worktree" item.

## Repo Resolution

The PR object has `repo` (e.g. `"Wint-AB/Salary"`) but no local path. Resolution order:

1. **Explicit match** — scan `favoriteFolders` for one where `githubRepo === pr.repo`
2. **Name match** — extract repo name from `pr.repo` (strip org), match against `favoriteFolders[].name` case-insensitively
3. **Fail** — show error toast: `Could not resolve "{repo}" to a local path. Add it as a favorite folder.`

No new IPC channels needed — resolution happens in the renderer using already-loaded config.

## Branch Field

The `PullRequest` interface currently lacks a branch field. The GraphQL query already fetches `headRefName` and `RawPrNode` has it, but `parseRawPr` drops it.

Changes:
- Add `branch: string` to `PullRequest` in `shared/types.ts`
- Pipe `node.headRefName` through in `parseRawPr` in `pr-models.ts`

## Worktree Creation Flow

1. User right-clicks PR → hovers "Review in worktree" → clicks a provider
2. Context menu closes
3. Resolve `pr.repo` to local repo path via favorite folders (see above)
4. Show loading toast at bottom of PR sidebar
5. Call `window.cccAPI.git.addWorktree(repoPath, pr.branch, '')` — empty target path triggers auto-resolve via `resolveWorktreePath`, producing `{basePath}/{branch}/{repoName}`
6. On success: call `window.cccAPI.session.create()` with:
   - `dir`: worktree path from result
   - `type`: selected provider
   - `name`: `"review/{repoShort}#{pr.number}"` (e.g. `"review/Salary#142"`)
7. On failure: show error toast

## Toast Feedback

New `PrToast` component rendered at the bottom of `PrSidebar`.

States:
- **Loading** — green-tinted background, spinner, "Creating worktree..." with `{branch} → {repo}` subtitle
- **Error** — red-tinted background, error icon, message text, dismiss button. Persists until dismissed.
- **Success** — no explicit toast. The new session appearing in the session sidebar is the confirmation.

Only one toast at a time. New action replaces any existing toast.

## Type Changes

### `PullRequest` (shared/types.ts)
```typescript
// Add:
branch: string
```

### `FavoriteFolder` (shared/types.ts)
```typescript
// Add:
githubRepo?: string  // e.g. "Wint-AB/Salary"
```

## Files to Change

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `branch` to `PullRequest`, `githubRepo` to `FavoriteFolder` |
| `src/main/pr-models.ts` | Pipe `headRefName` → `branch` in `parseRawPr` |
| `src/renderer/components/PrRow.tsx` | Add `onContextMenu` prop, forward event to parent |
| `src/renderer/components/PrSidebar.tsx` | Handle context menu state, render `PrContextMenu` and `PrToast`, orchestrate worktree creation + session launch |
| `src/renderer/components/PrContextMenu.tsx` | New — context menu with submenu |
| `src/renderer/components/PrToast.tsx` | New — toast notification component |

No IPC changes. No backend changes beyond `pr-models.ts`.
