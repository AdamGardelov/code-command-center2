import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, ExternalLink, X } from 'lucide-react'
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
  const explicit = favorites.find(f => f.githubRepo === repo)
  if (explicit) return explicit.path
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
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-1)' }}>
      {/* Header — matches SessionSidebar header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ padding: '8px 10px 4px', gap: 6 }}
      >
        <span
          className="flex-1"
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)'
          }}
        >
          Pull Requests
        </span>
        {prState.lastUpdated && (
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>
            {timeAgo(prState.lastUpdated)}
          </span>
        )}
        <button
          onClick={() => window.cccAPI.pr.refresh()}
          className="flex items-center justify-center rounded transition-colors duration-100"
          style={{ width: 20, height: 20, color: 'var(--ink-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-2)'
            e.currentTarget.style.color = 'var(--amber)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--ink-3)'
          }}
          title="Refresh"
        >
          <RefreshCw size={12} className={prState.isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {prState.error && (
        <div
          className="flex-shrink-0"
          style={{
            padding: '6px 10px',
            fontSize: 10,
            color: 'var(--s-error)',
            borderBottom: '1px solid var(--line)',
            backgroundColor: 'color-mix(in srgb, var(--s-error) 8%, transparent)'
          }}
        >
          Error: {prState.error}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex flex-shrink-0"
        style={{
          padding: '8px 10px 0',
          gap: 14,
          borderBottom: '1px solid var(--line)'
        }}
      >
        {tabs.map((t) => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="relative transition-colors"
              style={{
                padding: '6px 2px 9px',
                fontSize: 11,
                fontWeight: 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? 'var(--amber)' : 'var(--ink-3)'
              }}
            >
              {t.label}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  marginLeft: 4,
                  color: active ? 'var(--amber)' : 'var(--ink-4)'
                }}
              >
                {t.count}
              </span>
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    backgroundColor: 'var(--amber)'
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* PR list */}
      <div
        className="flex-1 overflow-y-auto ccc-scroll min-h-0"
        style={{ padding: '6px 6px' }}
      >
        {/* Needs Attention */}
        {prState.attentionItems.length > 0 && (
          <div style={{ margin: '4px 4px 10px' }}>
            {prState.attentionItems.map((item) => {
              const isReady = item.reason === 'ready_to_merge'
              const color = isReady ? 'var(--amber)' : 'var(--s-error)'
              return (
                <div
                  key={item.pr.id}
                  className="flex"
                  style={{
                    gap: 8,
                    alignItems: 'flex-start',
                    padding: '8px 10px',
                    marginBottom: 4,
                    borderRadius: 8,
                    backgroundColor: isReady
                      ? 'color-mix(in srgb, var(--amber) 8%, transparent)'
                      : 'color-mix(in srgb, var(--s-error) 8%, transparent)',
                    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                    fontSize: 11
                  }}
                >
                  <AlertCircle size={14} style={{ color, flexShrink: 0, marginTop: 1 }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                      {isReady ? 'Ready to merge' : 'Changes requested'}
                    </div>
                    <div
                      className="truncate"
                      style={{
                        color: 'var(--ink-3)',
                        marginTop: 2,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10
                      }}
                    >
                      #{item.pr.number} · {item.pr.repo}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0" style={{ gap: 2 }}>
                    <button
                      onClick={() => window.cccAPI.shell.openExternal(item.pr.url)}
                      className="flex items-center justify-center rounded transition-colors"
                      style={{ width: 20, height: 20, color: 'var(--ink-3)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                      title="Open in browser"
                    >
                      <ExternalLink size={11} />
                    </button>
                    <button
                      onClick={() => void handleDismissAttention(item.pr.id)}
                      className="flex items-center justify-center rounded transition-colors"
                      style={{ width: 20, height: 20, color: 'var(--ink-3)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                      title="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tabPrs[activeTab].length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ height: 80, fontSize: 11, color: 'var(--ink-3)' }}
          >
            {prState.isLoading ? 'Loading…' : 'No pull requests'}
          </div>
        ) : (
          tabPrs[activeTab].map((pr) => (
            <PrRow key={pr.id} pr={pr} onContextMenu={handleContextMenu} />
          ))
        )}
      </div>

      {toast && <PrToast toast={toast} onDismiss={() => setToast(null)} />}

      {contextMenu && (
        <PrContextMenu
          pr={contextMenu.pr}
          x={contextMenu.x}
          y={contextMenu.y}
          enabledProviders={enabledProviders}
          onClose={() => setContextMenu(null)}
          onOpenInBrowser={() => window.cccAPI.shell.openExternal(contextMenu.pr.url)}
          onCopyUrl={() => window.cccAPI.clipboard.writeText(contextMenu.pr.url)}
          onReviewInWorktree={(provider) => void handleReviewInWorktree(contextMenu.pr, provider)}
        />
      )}
    </div>
  )
}
