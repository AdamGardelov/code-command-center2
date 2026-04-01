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
