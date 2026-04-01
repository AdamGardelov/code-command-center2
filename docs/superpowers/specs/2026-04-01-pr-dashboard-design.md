# PR Dashboard Design

## Overview

New sidebar tab for monitoring GitHub pull requests. Opt-in feature behind a feature flag system. Uses `gh` CLI for data fetching. Three PR categories (Mine, Team, Reviews) with a "Needs Attention" section highlighting PRs that require immediate action.

## Feature Flag System

New `features` object in `CccConfig`:

```ts
features: {
  pullRequests: boolean  // default false, opt-in
}
```

- `DEFAULT_CONFIG` gets `features: {}` — all features off by default
- Settings modal gets a "Features" section with toggles
- The icon rail only renders icons for enabled features
- Sessions view is core functionality, not feature-flagged

## Activity Bar (Icon Rail)

New `ActivityBar` component — 32px wide vertical strip to the left of the sidebar.

- Sessions icon: always visible (not feature-flagged), uses terminal/panel icon
- PR icon: visible only when `features.pullRequests === true`, uses git-pull-request icon from lucide
- Active icon: subtle background highlight (`rgba(233,200,128,0.15)`) + accent color
- Notification dot: 8px accent-colored circle on PR icon when attention items exist
- Tooltip on hover showing label
- Layout change: `ActivityBar | SidebarContent | DragHandle | MainContent`

State addition to session store:

```ts
activeView: 'sessions' | 'pullRequests'  // default 'sessions'
```

## PR Data Layer

### PrService (main process)

New service that fetches PR data via `gh` CLI (`child_process.execFile`).

**GitHub API calls (GraphQL via `gh api graphql`):**

1. `fetchCurrentUser()` — `viewer { login }`
2. `fetchPRs(repos)` — fetch open PRs from pinned repos, batched max 10 per query
3. `searchByAuthors(org, authors, currentUser)` — search PRs by team members + review-requested, batched max 10 per query

**PR data model:**

```ts
interface PullRequest {
  id: string
  number: number
  title: string
  url: string
  repo: string              // "owner/name"
  author: string
  isDraft: boolean
  additions: number
  deletions: number
  reviewDecision: 'approved' | 'changes_requested' | 'review_required' | 'none'
  reviewers: Array<{
    login: string
    state: 'pending' | 'approved' | 'changes_requested'
  }>
  checksStatus: 'passing' | 'failing' | 'pending' | 'none'
  commentCount: number
  unresolvedThreads: number
  createdAt: string
  updatedAt: string
}
```

**Categorization:**

- `mine` — `author === currentUser`
- `reviews` — any reviewer entry for currentUser with `state === 'pending'`
- `team` — everything else

**Attention items (from `mine` only):**

- Ready to merge: `reviewDecision === 'approved' && checksStatus === 'passing'`
- Changes requested: `reviewDecision === 'changes_requested'`

**Polling:**

- Default interval: 120 seconds (configurable 30–300)
- Pauses when app is minimized/hidden
- Resumes on focus
- Change detection: compares previous poll to detect state transitions

**IPC:** New channel `pr:state` pushes PR data to renderer on each poll. New channel `pr:refresh` for manual refresh from renderer.

### Config additions

New fields in `CccConfig`:

```ts
prConfig: {
  githubOrg: string
  pinnedRepos: string[]
  teamMembers: string[]
  pollInterval: number          // default 120
  showMyDrafts: boolean         // default true
  showOthersDrafts: boolean     // default false
  notifications: {
    approved: boolean           // default true
    changesRequested: boolean   // default true
    newComment: boolean         // default true
    newReviewer: boolean        // default true
    newPr: boolean              // default true
  }
  dismissedAttention: string[]  // PR ids
}
```

## PR Sidebar UI

New `PrSidebar` component — rendered instead of `SessionSidebar` when `activeView === 'pullRequests'`.

### Structure (top to bottom)

1. **Header** — "Pull Requests" title + "last updated X ago" text + refresh button (circular arrow icon)

2. **Needs Attention section** — collapsible, shown only when attention items exist
   - Warning icon + "Needs Attention" label in accent color
   - Each item: PR title + reason text (green "Ready to merge" or red "Changes requested")
   - Left border color indicates type (green = ready, red = changes)
   - Open-in-browser button per item
   - Dismiss button per item (stores PR id in `dismissedAttention`)

3. **Tab bar** — three equal-width tabs: Mine, Team, Reviews
   - Active tab: accent color + bottom border
   - Each tab shows count badge
   - Clicking switches the list below

4. **PR list** — flat scrollable list for active tab, each PR row shows:
   - Line 1: Title + status badge (Approved green, Changes red, Draft gray, In Review yellow)
   - Line 2: Repo shortname + #number + +additions -deletions + checks icon
   - Line 3: Reviewer names with status symbols (✓ approved, ✗ changes, ○ pending)
   - Click anywhere on row opens PR in browser

5. **Footer** — poll status, error messages if any

### Onboarding state

When `features.pullRequests === true` but `prConfig` is missing org/repos: show a setup form instead of the PR list.

Setup form fields:
- GitHub Organization (text input)
- Pinned Repos (comma-separated text input)
- Team Members (comma-separated text input)

Save button writes to config and triggers first poll.

### PR actions

- Click PR row: opens PR URL in default browser via `shell.openExternal()`
- No other actions in v1 (merge, add reviewer, etc. deferred to future)

## Notifications

Extends existing `NotificationService` with PR events.

**New triggers:**

| Event | Condition |
|-------|-----------|
| PR approved | Your PR: pending/changes → approved |
| Changes requested | Your PR: pending/approved → changes_requested |
| New comment | Your PR: comment count increased |
| New reviewer | Your PR: new reviewer entry appeared |
| New PR | Team: new PR id not seen in previous poll |

**Delivery:** Same as existing session notifications — OS-native when app not focused, in-app toast when focused. Clicking a PR notification switches to PR tab.

**Per-event toggles** in `prConfig.notifications`, all default true. Configurable in Settings under PR section.

**First poll skip:** No notifications on first poll (avoids flood on startup).

## Settings Modal Changes

New sections in the existing `SettingsModal`:

1. **Features section** — toggles for opt-in features (currently just "Pull Requests")
2. **Pull Requests section** (visible only when PR feature enabled):
   - GitHub Organization
   - Pinned Repos
   - Team Members
   - Poll Interval (number input, 30–300)
   - Show my drafts (toggle)
   - Show others' drafts (toggle)
   - Notification toggles (approved, changes requested, new comment, new reviewer, new PR)

## File Structure

New files:
- `src/main/pr-service.ts` — PrService class (fetching, polling, change detection)
- `src/main/pr-models.ts` — PR type definitions and categorization logic
- `src/renderer/components/ActivityBar.tsx` — icon rail component
- `src/renderer/components/PrSidebar.tsx` — PR sidebar view
- `src/renderer/components/PrRow.tsx` — individual PR row component
- `src/renderer/components/PrSetup.tsx` — onboarding setup form

Modified files:
- `src/shared/types.ts` — CccConfig type additions (features, prConfig, PullRequest)
- `src/main/config-service.ts` — DEFAULT_CONFIG additions, prConfig parsing
- `src/main/index.ts` — PrService initialization, IPC handlers
- `src/main/notification-service.ts` — PR notification triggers
- `src/renderer/components/Layout.tsx` — ActivityBar integration
- `src/renderer/stores/session-store.ts` — activeView state
- `src/renderer/components/SettingsModal.tsx` — Features + PR settings sections
- `src/preload/index.ts` — PR IPC bridge
