# PR Worktree Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-click context menu on PR rows that creates a worktree for the PR's branch and auto-launches a review session.

**Architecture:** Extends the existing PR sidebar with a context menu component and toast feedback. The only backend change is piping the already-fetched `headRefName` into the `PullRequest` type. Repo resolution maps GitHub repo names to local paths via `favoriteFolders`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Zustand, Electron IPC (existing APIs only)

---

### Task 1: Add `branch` to PullRequest type and pipe through from parser

**Files:**
- Modify: `src/shared/types.ts:101-118`
- Modify: `src/main/pr-models.ts:76-93`

- [ ] **Step 1: Add `branch` field to `PullRequest` interface**

In `src/shared/types.ts`, add `branch: string` to the `PullRequest` interface after the `repo` field:

```typescript
export interface PullRequest {
  id: string
  number: number
  title: string
  url: string
  repo: string
  branch: string
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
```

- [ ] **Step 2: Pipe `headRefName` through in `parseRawPr`**

In `src/main/pr-models.ts`, add `branch: node.headRefName` to the return object of `parseRawPr` (after the `repo` field at line 81):

```typescript
  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    repo: repoFullName,
    branch: node.headRefName,
    author: node.author.login,
    // ... rest unchanged
  }
```

- [ ] **Step 3: Add `githubRepo` to `FavoriteFolder` interface**

In `src/shared/types.ts`, add the optional `githubRepo` field to `FavoriteFolder`:

```typescript
export interface FavoriteFolder {
  name: string
  path: string
  defaultBranch: string
  worktreePath?: string
  githubRepo?: string
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (the new field is required on `PullRequest` but `parseRawPr` now provides it; `githubRepo` is optional)

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/pr-models.ts
git commit -m "feat(pr): add branch field to PullRequest and githubRepo to FavoriteFolder"
```

---

### Task 2: Create `PrToast` component

**Files:**
- Create: `src/renderer/components/PrToast.tsx`

- [ ] **Step 1: Create the PrToast component**

Create `src/renderer/components/PrToast.tsx`:

```tsx
import { X } from 'lucide-react'

export interface PrToastState {
  type: 'loading' | 'error'
  message: string
  detail?: string
}

export default function PrToast({
  toast,
  onDismiss
}: {
  toast: PrToastState
  onDismiss: () => void
}): React.JSX.Element {
  const isError = toast.type === 'error'

  return (
    <div
      className="mx-2 mb-2 rounded-md px-3 py-2 flex items-center gap-2"
      style={{
        backgroundColor: isError ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
        border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`
      }}
    >
      {toast.type === 'loading' ? (
        <div
          className="w-3 h-3 flex-shrink-0 rounded-full"
          style={{
            border: '2px solid #4ade80',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite'
          }}
        />
      ) : (
        <span className="flex-shrink-0 text-[13px]" style={{ color: '#f87171' }}>&#10007;</span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>
          {toast.message}
        </div>
        {toast.detail && (
          <div className="text-[9px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {toast.detail}
          </div>
        )}
      </div>
      {isError && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[rgba(255,255,255,0.1)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PrToast.tsx
git commit -m "feat(pr): add PrToast feedback component"
```

---

### Task 3: Create `PrContextMenu` component

**Files:**
- Create: `src/renderer/components/PrContextMenu.tsx`

This is the core UI piece. It renders a positioned context menu with a "Review in worktree" submenu that lists enabled providers.

- [ ] **Step 1: Create the PrContextMenu component**

Create `src/renderer/components/PrContextMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { PullRequest, SessionType, AiProvider } from '../../shared/types'

interface PrContextMenuProps {
  pr: PullRequest
  x: number
  y: number
  enabledProviders: AiProvider[]
  onClose: () => void
  onOpenInBrowser: () => void
  onCopyUrl: () => void
  onReviewInWorktree: (provider: SessionType) => void
}

export default function PrContextMenu({
  pr,
  x,
  y,
  enabledProviders,
  onClose,
  onOpenInBrowser,
  onCopyUrl,
  onReviewInWorktree
}: PrContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const newX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x
    const newY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y
    setAdjustedPos({ x: newX, y: newY })
  }, [x, y])

  // Close on click-outside
  useEffect(() => {
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const providerItems: { type: SessionType; label: string }[] = []
  if (enabledProviders.includes('claude')) providerItems.push({ type: 'claude', label: 'Claude' })
  if (enabledProviders.includes('gemini')) providerItems.push({ type: 'gemini', label: 'Gemini' })
  if (enabledProviders.includes('codex')) providerItems.push({ type: 'codex', label: 'Codex' })
  providerItems.push({ type: 'shell', label: 'Shell' })

  const menuItemClass = 'w-full text-left px-3 py-1.5 text-[11px] transition-colors hover:bg-[rgba(255,255,255,0.06)]'
  const repoShort = pr.repo.split('/').pop() ?? pr.repo

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-md py-1 shadow-lg"
      style={{
        left: adjustedPos.x,
        top: adjustedPos.y,
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        minWidth: 180
      }}
    >
      <button
        className={menuItemClass}
        style={{ color: 'var(--text-primary)' }}
        onClick={() => { onOpenInBrowser(); onClose() }}
      >
        Open in browser
      </button>
      <button
        className={menuItemClass}
        style={{ color: 'var(--text-primary)' }}
        onClick={() => { onCopyUrl(); onClose() }}
      >
        Copy PR URL
      </button>

      <div className="my-1" style={{ height: 1, backgroundColor: '#333' }} />

      {/* Review in worktree with submenu */}
      <div
        className="relative"
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
      >
        <button
          className={`${menuItemClass} flex items-center justify-between`}
          style={{ color: '#4ade80' }}
        >
          <span>Review in worktree</span>
          <span className="text-[9px] ml-2" style={{ opacity: 0.5 }}>&#9656;</span>
        </button>

        {submenuOpen && (
          <div
            className="absolute rounded-md py-1 shadow-lg"
            style={{
              left: '100%',
              top: 0,
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              minWidth: 120
            }}
          >
            {providerItems.map((item) => (
              <button
                key={item.type}
                className={menuItemClass}
                style={{ color: 'var(--text-primary)' }}
                onClick={() => { onReviewInWorktree(item.type); onClose() }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PrContextMenu.tsx
git commit -m "feat(pr): add PrContextMenu with provider submenu"
```

---

### Task 4: Wire up PrRow context menu event

**Files:**
- Modify: `src/renderer/components/PrRow.tsx`

- [ ] **Step 1: Add `onContextMenu` prop to PrRow**

Update `PrRow` to accept and forward a context menu event. The full updated component:

```tsx
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

export default function PrRow({
  pr,
  onContextMenu
}: {
  pr: PullRequest
  onContextMenu: (e: React.MouseEvent, pr: PullRequest) => void
}): React.JSX.Element {
  const repoShort = pr.repo.split('/').pop() ?? pr.repo

  const handleClick = (): void => {
    window.open(pr.url, '_blank')
  }

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, pr)
      }}
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

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: FAIL — `PrSidebar.tsx` passes `<PrRow pr={pr} />` without the new required `onContextMenu` prop. This is expected and will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/PrRow.tsx
git commit -m "feat(pr): add onContextMenu prop to PrRow"
```

---

### Task 5: Integrate context menu, toast, and worktree flow into PrSidebar

**Files:**
- Modify: `src/renderer/components/PrSidebar.tsx`

This is the orchestration task. It adds state for the context menu and toast, handles repo resolution, worktree creation, and session launch.

- [ ] **Step 1: Update PrSidebar with full integration**

Replace the contents of `src/renderer/components/PrSidebar.tsx` with:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react'
import PrRow from './PrRow'
import PrSetup from './PrSetup'
import PrContextMenu from './PrContextMenu'
import PrToast from './PrToast'
import type { PrToastState } from './PrToast'
import { useSessionStore } from '../stores/session-store'
import type { PrState, PrTab, PullRequest, SessionType, FavoriteFolder } from '../../shared/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function resolveRepoPath(repo: string, favorites: FavoriteFolder[]): string | null {
  // 1. Explicit match via githubRepo field
  const explicit = favorites.find(f => f.githubRepo === repo)
  if (explicit) return explicit.path

  // 2. Name match — strip org, match case-insensitively
  const repoName = repo.split('/').pop() ?? repo
  const byName = favorites.find(f => f.name.toLowerCase() === repoName.toLowerCase())
  if (byName) return byName.path

  return null
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
  const [contextMenu, setContextMenu] = useState<{ pr: PullRequest; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<PrToastState | null>(null)

  const favorites = useSessionStore((s) => s.favorites)
  const enabledProviders = useSessionStore((s) => s.enabledProviders)
  const createSession = useSessionStore((s) => s.createSession)

  useEffect(() => {
    window.cccAPI.pr.getState().then((state) => {
      if (state && Object.keys(state).length > 0) {
        setPrState((prev) => ({ ...prev, ...state }))
      }
    })
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

  const handleContextMenu = useCallback((e: React.MouseEvent, pr: PullRequest) => {
    setContextMenu({ pr, x: e.clientX, y: e.clientY })
  }, [])

  const handleReviewInWorktree = useCallback(async (pr: PullRequest, provider: SessionType) => {
    const repoPath = resolveRepoPath(pr.repo, favorites)
    if (!repoPath) {
      setToast({
        type: 'error',
        message: `Could not resolve "${pr.repo}" to a local path`,
        detail: 'Add it as a favorite folder or set its githubRepo field'
      })
      return
    }

    const repoShort = pr.repo.split('/').pop() ?? pr.repo
    setToast({
      type: 'loading',
      message: 'Creating worktree...',
      detail: `${pr.branch} → ${repoShort}`
    })

    try {
      const worktree = await window.cccAPI.git.addWorktree(repoPath, pr.branch, '')
      await createSession({
        name: `review/${repoShort}#${pr.number}`,
        workingDirectory: worktree.path,
        type: provider
      })
      setToast(null)
    } catch (err) {
      setToast({
        type: 'error',
        message: 'Failed to create worktree',
        detail: err instanceof Error ? err.message : String(err)
      })
    }
  }, [favorites, createSession])

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
          tabPrs[activeTab].map((pr) => (
            <PrRow key={pr.id} pr={pr} onContextMenu={handleContextMenu} />
          ))
        )}
      </div>

      {/* Toast */}
      {toast && <PrToast toast={toast} onDismiss={() => setToast(null)} />}

      {/* Context menu */}
      {contextMenu && (
        <PrContextMenu
          pr={contextMenu.pr}
          x={contextMenu.x}
          y={contextMenu.y}
          enabledProviders={enabledProviders}
          onClose={() => setContextMenu(null)}
          onOpenInBrowser={() => window.open(contextMenu.pr.url, '_blank')}
          onCopyUrl={() => window.cccAPI.clipboard.writeText(contextMenu.pr.url)}
          onReviewInWorktree={(provider) => void handleReviewInWorktree(contextMenu.pr, provider)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/PrSidebar.tsx
git commit -m "feat(pr): integrate context menu, toast, and worktree review flow"
```

---

### Task 6: Manual smoke test

**Files:** None (testing only)

- [ ] **Step 1: Run dev mode**

Run: `pnpm dev`

- [ ] **Step 2: Verify context menu**

1. Navigate to the Pull Requests sidebar
2. Right-click on any PR row
3. Verify the context menu appears at the cursor position
4. Verify "Open in browser" opens the PR URL
5. Verify "Copy PR URL" copies to clipboard
6. Hover over "Review in worktree" and verify the submenu appears with enabled providers
7. Click outside the menu to close it
8. Press Escape to close it

- [ ] **Step 3: Verify worktree creation (requires a matching favorite folder)**

1. Ensure a favorite folder exists that matches a PR's repo name
2. Right-click a PR → Review in worktree → pick a provider
3. Verify loading toast appears
4. Verify worktree is created and session launches
5. Verify toast dismisses on success

- [ ] **Step 4: Verify error handling**

1. Right-click a PR whose repo has no matching favorite folder
2. Pick any provider from the submenu
3. Verify error toast appears: "Could not resolve ... to a local path"
4. Click X to dismiss the error toast

- [ ] **Step 5: Build check**

Run: `pnpm build`
Expected: PASS
