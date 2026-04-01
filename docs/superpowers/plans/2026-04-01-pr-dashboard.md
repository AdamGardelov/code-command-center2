# PR Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PR monitoring tab to the sidebar with icon rail navigation, GitHub PR fetching via `gh` CLI, attention highlighting, and notifications.

**Architecture:** Feature flag system in config enables opt-in features. New ActivityBar (icon rail) renders left of sidebar content. PrService in main process polls GitHub via `gh api graphql`, pushes state to renderer via IPC. PrSidebar component renders Needs Attention + Mine/Team/Reviews tabs.

**Tech Stack:** Electron IPC, `gh` CLI (GraphQL), React, Zustand, lucide-react icons, existing NotificationService/ToastContainer

---

### Task 1: Types & Config — Feature Flags + PR Config

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/config-service.ts`

- [ ] **Step 1: Add types to `src/shared/types.ts`**

Add these types after the `Worktree` interface (line 66):

```ts
export interface PrReviewer {
  login: string
  state: 'pending' | 'approved' | 'changes_requested'
}

export interface PullRequest {
  id: string
  number: number
  title: string
  url: string
  repo: string
  author: string
  isDraft: boolean
  additions: number
  deletions: number
  reviewDecision: 'approved' | 'changes_requested' | 'review_required' | 'none'
  reviewers: PrReviewer[]
  checksStatus: 'passing' | 'failing' | 'pending' | 'none'
  commentCount: number
  unresolvedThreads: number
  createdAt: string
  updatedAt: string
}

export interface PrNotificationConfig {
  approved: boolean
  changesRequested: boolean
  newComment: boolean
  newReviewer: boolean
  newPr: boolean
}

export interface PrConfig {
  githubOrg: string
  pinnedRepos: string[]
  teamMembers: string[]
  pollInterval: number
  showMyDrafts: boolean
  showOthersDrafts: boolean
  notifications: PrNotificationConfig
  dismissedAttention: string[]
}

export interface FeaturesConfig {
  pullRequests: boolean
}

export type PrTab = 'mine' | 'team' | 'reviews'

export type ActiveView = 'sessions' | 'pullRequests'

export interface PrState {
  myPrs: PullRequest[]
  teamPrs: PullRequest[]
  reviewPrs: PullRequest[]
  attentionItems: Array<{ pr: PullRequest; reason: 'ready_to_merge' | 'changes_requested' }>
  currentUser: string
  lastUpdated: string | null
  isLoading: boolean
  error: string | null
}
```

Add `features` and `prConfig` to the `CccConfig` interface (after line 85, before the closing `}`):

```ts
  features: FeaturesConfig
  prConfig?: PrConfig
```

Add `pr` to the `CccAPI` interface (after the `group` section, before closing `}`):

```ts
  pr: {
    onState: (callback: (state: PrState) => void) => () => void
    refresh: () => void
  }
```

- [ ] **Step 2: Update `src/main/config-service.ts` DEFAULT_CONFIG**

Add to `DEFAULT_CONFIG` (after `claudeConfigRoutes: []` on line 23):

```ts
  features: { pullRequests: false },
```

- [ ] **Step 3: Update config parsing in `load()` method**

In the `load()` method, add parsing for the new fields inside the `if (existsSync(CONFIG_PATH))` block. Add after the `claudeConfigRoutes` parsing (around line 57):

```ts
          features: parsed.features && typeof parsed.features === 'object'
            ? { pullRequests: parsed.features.pullRequests === true }
            : { pullRequests: false },
          prConfig: parsed.prConfig && typeof parsed.prConfig === 'object'
            ? {
                githubOrg: typeof parsed.prConfig.githubOrg === 'string' ? parsed.prConfig.githubOrg : '',
                pinnedRepos: Array.isArray(parsed.prConfig.pinnedRepos) ? parsed.prConfig.pinnedRepos : [],
                teamMembers: Array.isArray(parsed.prConfig.teamMembers) ? parsed.prConfig.teamMembers : [],
                pollInterval: typeof parsed.prConfig.pollInterval === 'number' ? parsed.prConfig.pollInterval : 120,
                showMyDrafts: parsed.prConfig.showMyDrafts !== false,
                showOthersDrafts: parsed.prConfig.showOthersDrafts === true,
                notifications: parsed.prConfig.notifications && typeof parsed.prConfig.notifications === 'object'
                  ? {
                      approved: parsed.prConfig.notifications.approved !== false,
                      changesRequested: parsed.prConfig.notifications.changesRequested !== false,
                      newComment: parsed.prConfig.notifications.newComment !== false,
                      newReviewer: parsed.prConfig.notifications.newReviewer !== false,
                      newPr: parsed.prConfig.notifications.newPr !== false,
                    }
                  : { approved: true, changesRequested: true, newComment: true, newReviewer: true, newPr: true },
                dismissedAttention: Array.isArray(parsed.prConfig.dismissedAttention) ? parsed.prConfig.dismissedAttention : [],
              }
            : undefined,
```

- [ ] **Step 4: Update `update()` method**

Add to the `update()` method in `config-service.ts` (after the `defaultClaudeConfigDir` line around line 103):

```ts
    if (partial.features !== undefined) this.config.features = partial.features
    if (partial.prConfig !== undefined) this.config.prConfig = partial.prConfig
```

- [ ] **Step 5: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds (or only unrelated warnings)

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/config-service.ts
git commit -m "feat: add PR types, feature flags, and PR config to CccConfig"
```

---

### Task 2: PR Models — Categorization & Attention Logic

**Files:**
- Create: `src/main/pr-models.ts`

- [ ] **Step 1: Create `src/main/pr-models.ts`**

```ts
import type { PullRequest, PrState } from '../shared/types'

interface RawPrNode {
  id: string
  number: number
  title: string
  url: string
  author: { login: string }
  isDraft: boolean
  headRefName: string
  additions: number
  deletions: number
  reviewDecision: string | null
  reviewRequests: { nodes: Array<{ requestedReviewer: { login?: string; name?: string } | null }> }
  latestReviews: { nodes: Array<{ author: { login: string }; state: string }> }
  comments: { totalCount: number }
  reviewThreads: { nodes: Array<{ isResolved: boolean }> }
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
  createdAt: string
  updatedAt: string
}

function mapReviewDecision(raw: string | null): PullRequest['reviewDecision'] {
  switch (raw) {
    case 'APPROVED': return 'approved'
    case 'CHANGES_REQUESTED': return 'changes_requested'
    case 'REVIEW_REQUIRED': return 'review_required'
    default: return 'none'
  }
}

function mapChecksStatus(node: RawPrNode): PullRequest['checksStatus'] {
  const rollup = node.commits?.nodes?.[0]?.commit?.statusCheckRollup
  if (!rollup) return 'none'
  switch (rollup.state) {
    case 'SUCCESS': return 'passing'
    case 'FAILURE': case 'ERROR': return 'failing'
    case 'PENDING': case 'EXPECTED': return 'pending'
    default: return 'none'
  }
}

function isBot(login: string): boolean {
  return login.endsWith('[bot]') || login.includes('bot')
}

export function parseRawPr(node: RawPrNode, repoFullName: string): PullRequest {
  const pendingReviewers = (node.reviewRequests?.nodes ?? [])
    .map(r => r.requestedReviewer?.login)
    .filter((login): login is string => !!login && !isBot(login))

  const latestReviewByUser = new Map<string, string>()
  for (const review of (node.latestReviews?.nodes ?? [])) {
    if (!isBot(review.author.login)) {
      latestReviewByUser.set(review.author.login, review.state)
    }
  }

  const reviewers: PullRequest['reviewers'] = []

  for (const login of pendingReviewers) {
    reviewers.push({ login, state: 'pending' })
  }

  for (const [login, state] of latestReviewByUser) {
    if (pendingReviewers.includes(login)) continue
    let mapped: 'approved' | 'changes_requested' | 'pending' = 'pending'
    if (state === 'APPROVED') mapped = 'approved'
    else if (state === 'CHANGES_REQUESTED') mapped = 'changes_requested'
    reviewers.push({ login, state: mapped })
  }

  const commentCount = node.comments?.totalCount ?? 0
  const unresolvedThreads = (node.reviewThreads?.nodes ?? []).filter(t => !t.isResolved).length

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    repo: repoFullName,
    author: node.author.login,
    isDraft: node.isDraft,
    additions: node.additions,
    deletions: node.deletions,
    reviewDecision: mapReviewDecision(node.reviewDecision),
    reviewers,
    checksStatus: mapChecksStatus(node),
    commentCount,
    unresolvedThreads,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

export function categorizePrs(
  prs: PullRequest[],
  currentUser: string,
  showMyDrafts: boolean,
  showOthersDrafts: boolean
): Pick<PrState, 'myPrs' | 'teamPrs' | 'reviewPrs' | 'attentionItems'> {
  const myPrs: PullRequest[] = []
  const teamPrs: PullRequest[] = []
  const reviewPrs: PullRequest[] = []

  for (const pr of prs) {
    if (pr.author === currentUser) {
      if (pr.isDraft && !showMyDrafts) continue
      myPrs.push(pr)
    } else if (pr.reviewers.some(r => r.login === currentUser && r.state === 'pending')) {
      reviewPrs.push(pr)
    } else {
      if (pr.isDraft && !showOthersDrafts) continue
      teamPrs.push(pr)
    }
  }

  const attentionItems: PrState['attentionItems'] = []
  for (const pr of myPrs) {
    if (pr.reviewDecision === 'approved' && pr.checksStatus === 'passing') {
      attentionItems.push({ pr, reason: 'ready_to_merge' })
    } else if (pr.reviewDecision === 'changes_requested') {
      attentionItems.push({ pr, reason: 'changes_requested' })
    }
  }

  return { myPrs, teamPrs, reviewPrs, attentionItems }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/main/pr-models.ts
git commit -m "feat: add PR parsing and categorization logic"
```

---

### Task 3: PrService — GitHub Fetching & Polling

**Files:**
- Create: `src/main/pr-service.ts`

- [ ] **Step 1: Create `src/main/pr-service.ts`**

```ts
import { execFile } from 'child_process'
import { BrowserWindow } from 'electron'
import type { ConfigService } from './config-service'
import type { PullRequest, PrState, PrConfig } from '../shared/types'
import { parseRawPr, categorizePrs } from './pr-models'

const PR_FIELDS = `
  id number title url
  author { login }
  isDraft headRefName
  additions deletions
  reviewDecision
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { name } } } }
  latestReviews(first: 10) { nodes { author { login } state } }
  comments { totalCount }
  reviewThreads(first: 100) { nodes { isResolved } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  createdAt updatedAt
`

function gh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

export class PrService {
  private configService: ConfigService
  private window: BrowserWindow | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private currentUser = ''
  private previousPrs: PullRequest[] = []
  private isFirstPoll = true

  constructor(configService: ConfigService) {
    this.configService = configService
  }

  setWindow(win: BrowserWindow): void {
    this.window = win

    win.on('focus', () => {
      if (!this.timer && this.configService.get().features.pullRequests) {
        this.start()
      }
    })

    win.on('blur', () => {
      // Keep polling in background but at reduced rate is not needed for v1
      // Could stop here if we want to save API calls
    })
  }

  start(): void {
    const config = this.configService.get()
    if (!config.features.pullRequests || !config.prConfig) return

    this.stop()
    void this.pollOnce()

    const interval = (config.prConfig.pollInterval ?? 120) * 1000
    this.timer = setInterval(() => void this.pollOnce(), interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async refresh(): Promise<void> {
    await this.pollOnce()
  }

  private async pollOnce(): Promise<void> {
    const config = this.configService.get()
    if (!config.prConfig) return

    const prConfig = config.prConfig

    this.sendState({ isLoading: true })

    try {
      if (!this.currentUser) {
        this.currentUser = await this.fetchCurrentUser()
      }

      const prs = await this.fetchAllPrs(prConfig)
      const { myPrs, teamPrs, reviewPrs, attentionItems } = categorizePrs(
        prs,
        this.currentUser,
        prConfig.showMyDrafts,
        prConfig.showOthersDrafts
      )

      const dismissedSet = new Set(prConfig.dismissedAttention)
      const filteredAttention = attentionItems.filter(a => !dismissedSet.has(a.pr.id))

      const state: PrState = {
        myPrs,
        teamPrs,
        reviewPrs,
        attentionItems: filteredAttention,
        currentUser: this.currentUser,
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        error: null,
      }

      if (!this.isFirstPoll) {
        this.detectChanges(prs, prConfig)
      }
      this.isFirstPoll = false
      this.previousPrs = prs

      this.sendState(state)
    } catch (err) {
      this.sendState({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  private async fetchCurrentUser(): Promise<string> {
    const result = await gh(['api', 'graphql', '-f', 'query=query { viewer { login } }'])
    const data = JSON.parse(result)
    return data.data.viewer.login
  }

  private async fetchAllPrs(prConfig: PrConfig): Promise<PullRequest[]> {
    const allPrs: PullRequest[] = []

    // Fetch from pinned repos
    if (prConfig.pinnedRepos.length > 0) {
      const repoPrs = await this.fetchRepoPrs(prConfig.githubOrg, prConfig.pinnedRepos)
      allPrs.push(...repoPrs)
    }

    // Search for team member PRs + review requests
    if (prConfig.teamMembers.length > 0) {
      const searchPrs = await this.searchPrs(prConfig.githubOrg, prConfig.teamMembers)
      // Deduplicate by id
      const existingIds = new Set(allPrs.map(pr => pr.id))
      for (const pr of searchPrs) {
        if (!existingIds.has(pr.id)) {
          allPrs.push(pr)
          existingIds.add(pr.id)
        }
      }
    }

    // Search for PRs requesting my review
    if (this.currentUser) {
      const reviewPrs = await this.searchReviewRequested(prConfig.githubOrg)
      const existingIds = new Set(allPrs.map(pr => pr.id))
      for (const pr of reviewPrs) {
        if (!existingIds.has(pr.id)) {
          allPrs.push(pr)
          existingIds.add(pr.id)
        }
      }
    }

    return allPrs
  }

  private async fetchRepoPrs(org: string, repos: string[]): Promise<PullRequest[]> {
    const prs: PullRequest[] = []
    // Batch max 10 repos per query
    for (let i = 0; i < repos.length; i += 10) {
      const batch = repos.slice(i, i + 10)
      const query = batch.map((repo, idx) => {
        const repoName = repo.includes('/') ? repo.split('/')[1] : repo
        const repoOwner = repo.includes('/') ? repo.split('/')[0] : org
        return `repo${idx}: repository(owner: "${repoOwner}", name: "${repoName}") {
          nameWithOwner
          pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes { ${PR_FIELDS} }
          }
        }`
      }).join('\n')

      const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
      const data = JSON.parse(result)

      for (let idx = 0; idx < batch.length; idx++) {
        const repoData = data.data[`repo${idx}`]
        if (!repoData) continue
        const repoFullName = repoData.nameWithOwner
        for (const node of repoData.pullRequests.nodes) {
          prs.push(parseRawPr(node, repoFullName))
        }
      }
    }
    return prs
  }

  private async searchPrs(org: string, authors: string[]): Promise<PullRequest[]> {
    const prs: PullRequest[] = []
    // Batch max 10 searches per query
    for (let i = 0; i < authors.length; i += 10) {
      const batch = authors.slice(i, i + 10)
      const query = batch.map((author, idx) => {
        return `search${idx}: search(query: "is:pr is:open org:${org} author:${author}", type: ISSUE, first: 50) {
          nodes { ... on PullRequest { ${PR_FIELDS} repository { nameWithOwner } } }
        }`
      }).join('\n')

      const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
      const data = JSON.parse(result)

      for (let idx = 0; idx < batch.length; idx++) {
        const searchData = data.data[`search${idx}`]
        if (!searchData) continue
        for (const node of searchData.nodes) {
          if (node.repository) {
            prs.push(parseRawPr(node, node.repository.nameWithOwner))
          }
        }
      }
    }
    return prs
  }

  private async searchReviewRequested(org: string): Promise<PullRequest[]> {
    const query = `search0: search(query: "is:pr is:open org:${org} review-requested:${this.currentUser}", type: ISSUE, first: 50) {
      nodes { ... on PullRequest { ${PR_FIELDS} repository { nameWithOwner } } }
    }`

    const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
    const data = JSON.parse(result)

    const prs: PullRequest[] = []
    const searchData = data.data.search0
    if (searchData) {
      for (const node of searchData.nodes) {
        if (node.repository) {
          prs.push(parseRawPr(node, node.repository.nameWithOwner))
        }
      }
    }
    return prs
  }

  private detectChanges(newPrs: PullRequest[], prConfig: PrConfig): void {
    if (!this.window || this.window.isDestroyed()) return

    const oldMap = new Map(this.previousPrs.map(pr => [pr.id, pr]))

    for (const pr of newPrs) {
      if (pr.author !== this.currentUser) {
        // Check for new team PR
        if (!oldMap.has(pr.id) && prConfig.notifications.newPr) {
          this.sendNotification(`New PR`, `${pr.repo} #${pr.number}: ${pr.title}`)
        }
        continue
      }

      const old = oldMap.get(pr.id)
      if (!old) continue

      if (old.reviewDecision !== 'approved' && pr.reviewDecision === 'approved' && prConfig.notifications.approved) {
        this.sendNotification('PR Approved', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (old.reviewDecision !== 'changes_requested' && pr.reviewDecision === 'changes_requested' && prConfig.notifications.changesRequested) {
        this.sendNotification('Changes Requested', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (pr.commentCount > old.commentCount && prConfig.notifications.newComment) {
        this.sendNotification('New Comment', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (pr.reviewers.length > old.reviewers.length && prConfig.notifications.newReviewer) {
        this.sendNotification('New Reviewer', `${pr.repo} #${pr.number}: ${pr.title}`)
      }
    }
  }

  private sendNotification(title: string, body: string): void {
    if (!this.window || this.window.isDestroyed()) return

    const { Notification } = require('electron') as typeof import('electron')
    const config = this.configService.get()
    if (!config.notificationsEnabled) return

    if (this.window.isFocused()) {
      this.window.webContents.send('notification:toast', {
        sessionName: 'PR',
        message: `${title}: ${body}`,
        color: '#e9c880',
      })
    } else {
      const notification = new Notification({ title, body })
      notification.on('click', () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show()
          this.window.focus()
          this.window.webContents.send('pr:navigate')
        }
      })
      notification.show()
    }
  }

  private sendState(partial: Partial<PrState>): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('pr:state', partial)
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/main/pr-service.ts
git commit -m "feat: add PrService with GitHub polling and change detection"
```

---

### Task 4: IPC Bridge — Preload & Main Process Wiring

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add PR IPC to preload (`src/preload/index.ts`)**

Add the `pr` section to the `api` object, after the `group` section (after line 109, before the closing `}`):

```ts
  pr: {
    onState: (callback: (state: import('../shared/types').PrState) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        state: import('../shared/types').PrState
      ): void => {
        callback(state)
      }
      ipcRenderer.on('pr:state', handler)
      return () => ipcRenderer.removeListener('pr:state', handler)
    },
    refresh: () => ipcRenderer.send('pr:refresh'),
    onNavigate: (callback: () => void) => {
      const handler = (): void => { callback() }
      ipcRenderer.on('pr:navigate', handler)
      return () => ipcRenderer.removeListener('pr:navigate', handler)
    }
  }
```

Also update the `CccAPI` type in `src/shared/types.ts` — replace the `pr` section added in Task 1 with:

```ts
  pr: {
    onState: (callback: (state: PrState) => void) => () => void
    refresh: () => void
    onNavigate: (callback: () => void) => () => void
  }
```

- [ ] **Step 2: Wire PrService in `src/main/index.ts`**

Add import after the `NotificationService` import (line 32):

```ts
import { PrService } from './pr-service'
```

Add PrService instantiation after `notificationService` (after line 49):

```ts
const prService = new PrService(configService)
```

Inside `createWindow()`, after `notificationService.setWindow(mainWindow)` (line 72), add:

```ts
  prService.setWindow(mainWindow)
  if (configService.get().features.pullRequests) {
    prService.start()
  }
```

After the `registerGroupIpc` call (line 122), add IPC handler:

```ts
ipcMain.on('pr:refresh', () => {
  void prService.refresh()
})
```

In the `window-all-closed` handler (around line 145), add before `if (process.platform !== 'darwin')`:

```ts
  prService.stop()
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/main/index.ts src/shared/types.ts
git commit -m "feat: wire PrService IPC bridge between main and renderer"
```

---

### Task 5: ActivityBar Component

**Files:**
- Create: `src/renderer/components/ActivityBar.tsx`
- Modify: `src/renderer/stores/session-store.ts`

- [ ] **Step 1: Add `activeView` to session store**

In `src/renderer/stores/session-store.ts`, add to the `SessionStore` interface (after line 24, `ideCommand: string`):

```ts
  activeView: ActiveView
  features: FeaturesConfig
  setActiveView: (view: ActiveView) => void
```

Add the import at the top (line 2):

```ts
import type { Session, SessionCreate, ViewMode, Theme, SessionStatus, FavoriteFolder, AiProvider, RemoteHost, SessionGroup, ActiveView, FeaturesConfig } from '../../shared/types'
```

Add defaults in the `create` call (after line 83, `ideCommand: ''`):

```ts
  activeView: 'sessions' as ActiveView,
  features: { pullRequests: false } as FeaturesConfig,
```

Add `setActiveView` method (after `setIdeCommand` implementation, around line 282):

```ts
  setActiveView: (view) => set({ activeView: view }),
```

In `loadConfig`, add to the `set()` call (after `ideCommand: config.ideCommand ?? ''`):

```ts
      features: config.features ?? { pullRequests: false },
```

- [ ] **Step 2: Create `src/renderer/components/ActivityBar.tsx`**

```tsx
import { SquareTerminal, GitPullRequestArrow } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import type { ActiveView } from '../../shared/types'

interface ActivityBarItemProps {
  icon: React.ReactNode
  view: ActiveView
  active: boolean
  onClick: () => void
  badge?: boolean
  tooltip: string
}

function ActivityBarItem({ icon, active, onClick, badge, tooltip }: ActivityBarItemProps): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="relative flex items-center justify-center rounded transition-colors duration-100"
      style={{
        width: 28,
        height: 28,
        backgroundColor: active ? 'rgba(233,200,128,0.15)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {icon}
      {badge && (
        <div
          className="absolute rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: 'var(--accent)',
            top: -1,
            right: -1,
          }}
        />
      )}
    </button>
  )
}

export default function ActivityBar({ hasAttention }: { hasAttention: boolean }): React.JSX.Element {
  const activeView = useSessionStore((s) => s.activeView)
  const features = useSessionStore((s) => s.features)
  const setActiveView = useSessionStore((s) => s.setActiveView)

  return (
    <div
      className="flex flex-col items-center pt-2.5 gap-1 flex-shrink-0"
      style={{
        width: 36,
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--bg-raised)',
      }}
    >
      <ActivityBarItem
        icon={<SquareTerminal size={16} />}
        view="sessions"
        active={activeView === 'sessions'}
        onClick={() => setActiveView('sessions')}
        tooltip="Sessions"
      />
      {features.pullRequests && (
        <ActivityBarItem
          icon={<GitPullRequestArrow size={16} />}
          view="pullRequests"
          active={activeView === 'pullRequests'}
          onClick={() => setActiveView('pullRequests')}
          badge={hasAttention}
          tooltip="Pull Requests"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ActivityBar.tsx src/renderer/stores/session-store.ts
git commit -m "feat: add ActivityBar icon rail and activeView state"
```

---

### Task 6: Layout Integration — ActivityBar + View Switching

**Files:**
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Update Layout.tsx**

Add import at top (after `SessionSidebar` import, line 6):

```ts
import ActivityBar from './ActivityBar'
```

Add store selectors (after `const activeSession` on line 23):

```ts
  const activeView = useSessionStore((s) => s.activeView)
  const features = useSessionStore((s) => s.features)
```

Replace the sidebar rendering block. Find this block (lines 63-104):

```tsx
        {sidebarOpen ? (
          <>
            {/* Open sidebar */}
            <div
              className="overflow-hidden flex-shrink-0"
              style={{
                width: sidebarWidth,
                transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
              }}
            >
              <div className="h-full" style={{ width: sidebarWidth }}>
                <SessionSidebar />
              </div>
            </div>

            {/* Drag handle — thin line on the sidebar edge */}
            <div
              className="w-px flex-shrink-0 cursor-col-resize sidebar-drag-handle"
              style={{ backgroundColor: 'var(--bg-raised)' }}
              onMouseDown={handleDragStart}
            />
          </>
        ) : (
          /* Collapsed sidebar — narrow strip with expand button */
          <div
            className="w-8 flex-shrink-0 flex flex-col items-center pt-2 border-r"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-raised)'
            }}
          >
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}
```

Replace with:

```tsx
        {/* Activity Bar — always visible when features exist */}
        {features.pullRequests && (
          <ActivityBar hasAttention={false} />
        )}

        {sidebarOpen ? (
          <>
            {/* Open sidebar */}
            <div
              className="overflow-hidden flex-shrink-0"
              style={{
                width: sidebarWidth,
                transition: dragging.current ? 'none' : 'width 200ms ease-in-out'
              }}
            >
              <div className="h-full" style={{ width: sidebarWidth }}>
                {activeView === 'sessions' ? <SessionSidebar /> : <PrSidebar />}
              </div>
            </div>

            {/* Drag handle — thin line on the sidebar edge */}
            <div
              className="w-px flex-shrink-0 cursor-col-resize sidebar-drag-handle"
              style={{ backgroundColor: 'var(--bg-raised)' }}
              onMouseDown={handleDragStart}
            />
          </>
        ) : (
          /* Collapsed sidebar — narrow strip with expand button */
          <div
            className="w-8 flex-shrink-0 flex flex-col items-center pt-2 border-r"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--bg-raised)'
            }}
          >
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded transition-colors duration-100 hover:bg-[var(--bg-raised)]"
              style={{ color: 'var(--text-muted)' }}
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen size={14} />
            </button>
          </div>
        )}
```

Add a placeholder PrSidebar import at top (we'll create the real one in Task 7):

```ts
import PrSidebar from './PrSidebar'
```

- [ ] **Step 2: Create placeholder PrSidebar**

Create `src/renderer/components/PrSidebar.tsx` with minimal content so the build passes:

```tsx
export default function PrSidebar(): React.JSX.Element {
  return (
    <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
      <p className="text-xs">PR Dashboard loading...</p>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Layout.tsx src/renderer/components/PrSidebar.tsx
git commit -m "feat: integrate ActivityBar into Layout with view switching"
```

---

### Task 7: PrSidebar — Full Implementation

**Files:**
- Modify: `src/renderer/components/PrSidebar.tsx`
- Create: `src/renderer/components/PrRow.tsx`
- Create: `src/renderer/components/PrSetup.tsx`

- [ ] **Step 1: Create `src/renderer/components/PrRow.tsx`**

```tsx
import { ExternalLink } from 'lucide-react'
import type { PullRequest } from '../../shared/types'

function StatusBadge({ pr }: { pr: PullRequest }): React.JSX.Element {
  let label: string
  let bg: string
  let fg: string

  if (pr.isDraft) {
    label = 'Draft'; bg = '#666'; fg = '#ccc'
  } else if (pr.reviewDecision === 'approved') {
    label = 'Approved'; bg = '#4ade80'; fg = '#000'
  } else if (pr.reviewDecision === 'changes_requested') {
    label = 'Changes'; bg = '#f87171'; fg = '#000'
  } else if (pr.reviewers.length === 0) {
    label = 'No Reviewer'; bg = '#f59e0b'; fg = '#000'
  } else {
    label = 'In Review'; bg = '#e9c880'; fg = '#000'
  }

  return (
    <span
      className="flex-shrink-0 px-1.5 py-px rounded text-[8px] font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  )
}

function ChecksIcon({ status }: { status: PullRequest['checksStatus'] }): React.JSX.Element | null {
  if (status === 'none') return null
  const color = status === 'passing' ? '#4ade80' : status === 'failing' ? '#f87171' : '#e9c880'
  const symbol = status === 'passing' ? '✓' : status === 'failing' ? '✗' : '○'
  return <span style={{ color, fontSize: 9 }}>{symbol}</span>
}

function ReviewerList({ reviewers }: { reviewers: PullRequest['reviewers'] }): React.JSX.Element | null {
  if (reviewers.length === 0) return null
  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {reviewers.map((r) => {
        const color = r.state === 'approved' ? '#4ade80' : r.state === 'changes_requested' ? '#f87171' : '#888'
        const symbol = r.state === 'approved' ? '✓' : r.state === 'changes_requested' ? '✗' : '○'
        return (
          <span key={r.login} style={{ color, fontSize: 9 }}>
            {symbol} {r.login}
          </span>
        )
      })}
    </div>
  )
}

export default function PrRow({ pr }: { pr: PullRequest }): React.JSX.Element {
  const repoShort = pr.repo.split('/').pop() ?? pr.repo

  const handleClick = (): void => {
    window.open(pr.url, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-2 rounded-md transition-colors duration-100 hover:bg-[rgba(255,255,255,0.03)] cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.01)' }}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[11px] flex-1 leading-tight" style={{ color: pr.isDraft ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {pr.title}
        </span>
        <StatusBadge pr={pr} />
      </div>

      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{repoShort}</span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>#{pr.number}</span>
        <span className="text-[9px]" style={{ color: '#4ade80' }}>+{pr.additions}</span>
        <span className="text-[9px]" style={{ color: '#f87171' }}>-{pr.deletions}</span>
        <ChecksIcon status={pr.checksStatus} />
        {pr.unresolvedThreads > 0 && (
          <span className="text-[9px]" style={{ color: '#f59e0b' }}>⚠ {pr.unresolvedThreads}</span>
        )}
      </div>

      <ReviewerList reviewers={pr.reviewers} />
    </button>
  )
}
```

- [ ] **Step 2: Create `src/renderer/components/PrSetup.tsx`**

```tsx
import { useState } from 'react'

interface PrSetupProps {
  onSave: (org: string, repos: string[], members: string[]) => void
}

export default function PrSetup({ onSave }: PrSetupProps): React.JSX.Element {
  const [org, setOrg] = useState('')
  const [repos, setRepos] = useState('')
  const [members, setMembers] = useState('')

  const handleSave = (): void => {
    if (!org.trim()) return
    const repoList = repos.split(',').map(r => r.trim()).filter(Boolean)
    const memberList = members.split(',').map(m => m.trim()).filter(Boolean)
    onSave(org.trim(), repoList, memberList)
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-surface)' }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--bg-raised)' }}>
        <h2 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Setup Pull Requests</h2>
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Configure which repos and team members to track.
        </p>
      </div>

      <div className="p-3 flex flex-col gap-3 flex-1">
        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
            GitHub Organization
          </label>
          <input
            type="text"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="e.g. my-org"
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-raised)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
            Pinned Repos <span style={{ color: 'var(--text-muted)' }}>(comma-separated)</span>
          </label>
          <input
            type="text"
            value={repos}
            onChange={(e) => setRepos(e.target.value)}
            placeholder="e.g. api-server, dashboard, mobile-app"
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-raised)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
            Team Members <span style={{ color: 'var(--text-muted)' }}>(comma-separated GitHub usernames)</span>
          </label>
          <input
            type="text"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
            placeholder="e.g. alice, bob, charlie"
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--bg-raised)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!org.trim()}
          className="mt-auto px-3 py-2 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: org.trim() ? 'var(--accent)' : 'var(--bg-raised)',
            color: org.trim() ? '#000' : 'var(--text-muted)',
            cursor: org.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Save & Start Monitoring
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement full `src/renderer/components/PrSidebar.tsx`**

Replace the placeholder with the full implementation:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useSessionStore } from '../stores/session-store'
import PrRow from './PrRow'
import PrSetup from './PrSetup'
import type { PrState, PrTab, PullRequest } from '../../shared/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function PrSidebar(): React.JSX.Element {
  const [prState, setPrState] = useState<PrState>({
    myPrs: [],
    teamPrs: [],
    reviewPrs: [],
    attentionItems: [],
    currentUser: '',
    lastUpdated: null,
    isLoading: false,
    error: null,
  })
  const [activeTab, setActiveTab] = useState<PrTab>('mine')
  const [attentionOpen, setAttentionOpen] = useState(true)

  useEffect(() => {
    const unsub = window.cccAPI.pr.onState((state) => {
      setPrState((prev) => ({ ...prev, ...state }))
    })
    return unsub
  }, [])

  const handleSetup = useCallback(async (org: string, repos: string[], members: string[]) => {
    await window.cccAPI.config.update({
      prConfig: {
        githubOrg: org,
        pinnedRepos: repos,
        teamMembers: members,
        pollInterval: 120,
        showMyDrafts: true,
        showOthersDrafts: false,
        notifications: {
          approved: true,
          changesRequested: true,
          newComment: true,
          newReviewer: true,
          newPr: true,
        },
        dismissedAttention: [],
      },
    })
    window.cccAPI.pr.refresh()
  }, [])

  const handleDismissAttention = useCallback(async (prId: string) => {
    const config = await window.cccAPI.config.load()
    const dismissed = [...(config.prConfig?.dismissedAttention ?? []), prId]
    await window.cccAPI.config.update({
      prConfig: { ...config.prConfig!, dismissedAttention: dismissed },
    })
    setPrState((prev) => ({
      ...prev,
      attentionItems: prev.attentionItems.filter((a) => a.pr.id !== prId),
    }))
  }, [])

  // Check if setup is needed
  const config = useSessionStore((s) => s)
  const needsSetup = !prState.currentUser && !prState.isLoading && !prState.error

  // Show setup if we don't have config yet (first load, no state received)
  const [hasConfig, setHasConfig] = useState(false)
  useEffect(() => {
    window.cccAPI.config.load().then((c) => {
      setHasConfig(!!c.prConfig?.githubOrg)
    })
  }, [])

  if (!hasConfig && !prState.lastUpdated) {
    return <PrSetup onSave={handleSetup} />
  }

  const tabPrs: Record<PrTab, PullRequest[]> = {
    mine: prState.myPrs,
    team: prState.teamPrs,
    reviews: prState.reviewPrs,
  }

  const tabs: Array<{ key: PrTab; label: string; count: number }> = [
    { key: 'mine', label: 'Mine', count: prState.myPrs.length },
    { key: 'team', label: 'Team', count: prState.teamPrs.length },
    { key: 'reviews', label: 'Reviews', count: prState.reviewPrs.length },
  ]

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-surface)' }}>
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: 'var(--bg-raised)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          Pull Requests
        </span>
        <div className="flex items-center gap-2">
          {prState.lastUpdated && (
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {timeAgo(prState.lastUpdated)}
            </span>
          )}
          <button
            onClick={() => window.cccAPI.pr.refresh()}
            className="p-1 rounded transition-colors hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: 'var(--text-muted)' }}
            title="Refresh"
          >
            <RefreshCw size={12} className={prState.isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error */}
      {prState.error && (
        <div className="px-3 py-2 text-[10px] border-b" style={{ color: '#f87171', borderColor: 'var(--bg-raised)' }}>
          Error: {prState.error}
        </div>
      )}

      {/* Needs Attention */}
      {prState.attentionItems.length > 0 && (
        <div className="border-b flex-shrink-0" style={{ borderColor: 'var(--bg-raised)' }}>
          <button
            onClick={() => setAttentionOpen(!attentionOpen)}
            className="w-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-[rgba(255,255,255,0.02)]"
          >
            {attentionOpen ? <ChevronDown size={10} style={{ color: 'var(--accent)' }} /> : <ChevronRight size={10} style={{ color: 'var(--accent)' }} />}
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              Needs Attention
            </span>
            <span className="text-[9px] ml-auto" style={{ color: 'var(--accent)' }}>
              {prState.attentionItems.length}
            </span>
          </button>
          {attentionOpen && (
            <div className="px-3 pb-2 flex flex-col gap-1">
              {prState.attentionItems.map((item) => (
                <div
                  key={item.pr.id}
                  className="p-1.5 rounded"
                  style={{
                    backgroundColor: item.reason === 'ready_to_merge' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)',
                    borderLeft: `2px solid ${item.reason === 'ready_to_merge' ? '#4ade80' : '#f87171'}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.pr.title}
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: item.reason === 'ready_to_merge' ? '#4ade80' : '#f87171' }}>
                        {item.reason === 'ready_to_merge' ? 'Ready to merge' : 'Changes requested'}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => window.open(item.pr.url, '_blank')}
                        className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)]"
                        style={{ color: 'var(--text-muted)' }}
                        title="Open in browser"
                      >
                        <ExternalLink size={10} />
                      </button>
                      <button
                        onClick={() => void handleDismissAttention(item.pr.id)}
                        className="p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)]"
                        style={{ color: 'var(--text-muted)' }}
                        title="Dismiss"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--bg-raised)' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex-1 py-1.5 text-center text-[10px] font-medium transition-colors"
            style={{
              color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: activeTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.label}{' '}
            <span
              className="ml-0.5"
              style={{
                color: activeTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                opacity: activeTab === t.key ? 1 : 0.6,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* PR list */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {tabPrs[activeTab].length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {prState.isLoading ? 'Loading...' : 'No pull requests'}
            </span>
          </div>
        ) : (
          tabPrs[activeTab].map((pr) => <PrRow key={pr.id} pr={pr} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/PrSidebar.tsx src/renderer/components/PrRow.tsx src/renderer/components/PrSetup.tsx
git commit -m "feat: implement PrSidebar with tabs, attention section, and setup form"
```

---

### Task 8: ActivityBar Attention Badge Wiring

**Files:**
- Modify: `src/renderer/components/Layout.tsx`

- [ ] **Step 1: Wire attention state to ActivityBar**

In `Layout.tsx`, add state for PR attention. Add after the `features` selector:

```ts
  const [hasAttention, setHasAttention] = useState(false)

  useEffect(() => {
    if (!features.pullRequests) return
    const unsub = window.cccAPI.pr.onState((state) => {
      if (state.attentionItems) {
        setHasAttention(state.attentionItems.length > 0)
      }
    })
    return unsub
  }, [features.pullRequests])
```

Add `useState` and `useEffect` to the imports (line 1):

```ts
import { useCallback, useRef, useState, useEffect } from 'react'
```

Update the ActivityBar to pass `hasAttention`:

```tsx
<ActivityBar hasAttention={hasAttention} />
```

- [ ] **Step 2: Wire PR navigate (clicking native notification switches to PR tab)**

Add to the `useEffect`:

```ts
  useEffect(() => {
    if (!features.pullRequests) return
    const unsubState = window.cccAPI.pr.onState((state) => {
      if (state.attentionItems) {
        setHasAttention(state.attentionItems.length > 0)
      }
    })
    const unsubNav = window.cccAPI.pr.onNavigate(() => {
      useSessionStore.getState().setActiveView('pullRequests')
    })
    return () => {
      unsubState()
      unsubNav()
    }
  }, [features.pullRequests])
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Layout.tsx
git commit -m "feat: wire attention badge and PR navigate to Layout"
```

---

### Task 9: Settings Modal — Features & PR Config

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx`

- [ ] **Step 1: Add 'features' tab to SettingsModal**

Update the `Tab` type (line 6):

```ts
type Tab = 'providers' | 'favorites' | 'appearance' | 'remotes' | 'worktrees' | 'advanced' | 'features'
```

Add state for feature flags and PR config. After the existing state declarations (around line 50), add:

```ts
  const [featuresConfig, setFeaturesConfig] = useState({ pullRequests: false })
  const [prOrg, setPrOrg] = useState('')
  const [prRepos, setPrRepos] = useState('')
  const [prMembers, setPrMembers] = useState('')
  const [prPollInterval, setPrPollInterval] = useState(120)
  const [prShowMyDrafts, setPrShowMyDrafts] = useState(true)
  const [prShowOthersDrafts, setPrShowOthersDrafts] = useState(false)
```

In the existing `useEffect` that loads config on `settingsOpen` (around line 52-60), add inside the `.then`:

```ts
        setFeaturesConfig(config.features ?? { pullRequests: false })
        if (config.prConfig) {
          setPrOrg(config.prConfig.githubOrg ?? '')
          setPrRepos(config.prConfig.pinnedRepos?.join(', ') ?? '')
          setPrMembers(config.prConfig.teamMembers?.join(', ') ?? '')
          setPrPollInterval(config.prConfig.pollInterval ?? 120)
          setPrShowMyDrafts(config.prConfig.showMyDrafts !== false)
          setPrShowOthersDrafts(config.prConfig.showOthersDrafts === true)
        }
```

Add save handlers:

```ts
  const saveFeatures = (features: { pullRequests: boolean }): void => {
    setFeaturesConfig(features)
    void window.cccAPI.config.update({ features })
    // Reload store to reflect feature flag change
    void useSessionStore.getState().loadConfig()
  }

  const savePrConfig = (): void => {
    void window.cccAPI.config.update({
      prConfig: {
        githubOrg: prOrg,
        pinnedRepos: prRepos.split(',').map(r => r.trim()).filter(Boolean),
        teamMembers: prMembers.split(',').map(m => m.trim()).filter(Boolean),
        pollInterval: prPollInterval,
        showMyDrafts: prShowMyDrafts,
        showOthersDrafts: prShowOthersDrafts,
        notifications: { approved: true, changesRequested: true, newComment: true, newReviewer: true, newPr: true },
        dismissedAttention: [],
      },
    })
  }
```

Add the "Features" tab button in the tab bar (add alongside the other tab buttons — find the pattern in the existing code and add a new tab button for 'features').

Add the "Features" tab content panel. This renders when `tab === 'features'`:

```tsx
{tab === 'features' && (
  <div className="flex flex-col gap-4">
    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Features</h3>
    <label className="flex items-center justify-between">
      <div>
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Pull Requests</span>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Monitor GitHub PRs in the sidebar</p>
      </div>
      <input
        type="checkbox"
        checked={featuresConfig.pullRequests}
        onChange={(e) => saveFeatures({ ...featuresConfig, pullRequests: e.target.checked })}
        className="accent-[var(--accent)]"
      />
    </label>

    {featuresConfig.pullRequests && (
      <>
        <hr style={{ borderColor: 'var(--bg-raised)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PR Configuration</h3>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>GitHub Organization</label>
          <input
            type="text"
            value={prOrg}
            onChange={(e) => setPrOrg(e.target.value)}
            onBlur={savePrConfig}
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Pinned Repos (comma-separated)</label>
          <input
            type="text"
            value={prRepos}
            onChange={(e) => setPrRepos(e.target.value)}
            onBlur={savePrConfig}
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Team Members (comma-separated usernames)</label>
          <input
            type="text"
            value={prMembers}
            onChange={(e) => setPrMembers(e.target.value)}
            onBlur={savePrConfig}
            className="w-full px-2 py-1.5 rounded text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label className="text-[10px] font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Poll Interval (seconds, 30-300)</label>
          <input
            type="number"
            min={30}
            max={300}
            value={prPollInterval}
            onChange={(e) => setPrPollInterval(Number(e.target.value))}
            onBlur={savePrConfig}
            className="w-20 px-2 py-1.5 rounded text-xs border outline-none"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
          />
        </div>

        <label className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show my drafts</span>
          <input type="checkbox" checked={prShowMyDrafts} onChange={(e) => { setPrShowMyDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>Show others' drafts</span>
          <input type="checkbox" checked={prShowOthersDrafts} onChange={(e) => { setPrShowOthersDrafts(e.target.checked); setTimeout(savePrConfig, 0) }} className="accent-[var(--accent)]" />
        </label>
      </>
    )}
  </div>
)}
```

Import `useSessionStore` if not already imported (it already is).

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -30`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add Features tab and PR config to Settings modal"
```

---

### Task 10: Smoke Test & Polish

**Files:**
- Possibly minor fixes across multiple files

- [ ] **Step 1: Run full build**

Run: `npm run build 2>&1`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 2: Start dev mode and test**

Run: `npm run dev`

Test checklist:
1. App starts without errors
2. No ActivityBar visible (feature disabled by default)
3. Open Settings → Features tab → Enable "Pull Requests"
4. ActivityBar appears with Sessions (active) and PR icons
5. Click PR icon → shows setup form
6. Fill in org, repos, members → Save
7. PR list loads (or shows error if `gh` not authenticated)
8. Click a PR → opens in browser
9. Switch back to Sessions → normal sidebar
10. Notification dot appears on PR icon when attention items exist

- [ ] **Step 3: Fix any issues found during testing**

Address any build errors, runtime errors, or visual issues.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: polish PR dashboard after smoke testing"
```
