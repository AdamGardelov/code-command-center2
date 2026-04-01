import { useState, useEffect } from 'react'
import { useSessionStore } from '../../stores/session-store'

export default function FeaturesSettings(): React.JSX.Element {
  const [featuresConfig, setFeaturesConfig] = useState({ pullRequests: false, containers: false })
  const [prOrg, setPrOrg] = useState('')
  const [prRepos, setPrRepos] = useState('')
  const [prMembers, setPrMembers] = useState('')
  const [prPollInterval, setPrPollInterval] = useState(120)
  const [prShowMyDrafts, setPrShowMyDrafts] = useState(true)
  const [prShowOthersDrafts, setPrShowOthersDrafts] = useState(false)

  useEffect(() => {
    window.cccAPI.config.load().then((config) => {
      setFeaturesConfig(config.features ?? { pullRequests: false, containers: false })
      if (config.prConfig) {
        setPrOrg(config.prConfig.githubOrg ?? '')
        setPrRepos(config.prConfig.pinnedRepos?.join(', ') ?? '')
        setPrMembers(config.prConfig.teamMembers?.join(', ') ?? '')
        setPrPollInterval(config.prConfig.pollInterval ?? 120)
        setPrShowMyDrafts(config.prConfig.showMyDrafts !== false)
        setPrShowOthersDrafts(config.prConfig.showOthersDrafts === true)
      }
    })
  }, [])

  const saveFeatures = (features: { pullRequests: boolean; containers: boolean }): void => {
    setFeaturesConfig(features)
    void window.cccAPI.config.update({ features })
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

  return (
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
  )
}
