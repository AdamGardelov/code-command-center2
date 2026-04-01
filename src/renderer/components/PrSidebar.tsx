import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react'
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
    // Fetch current state to avoid race condition where initial poll
    // completed before this component mounted
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
