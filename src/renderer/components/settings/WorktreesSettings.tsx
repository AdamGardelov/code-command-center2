import { useSessionStore } from '../../stores/session-store'

export default function WorktreesSettings(): React.JSX.Element {
  const worktreeBasePath = useSessionStore((s) => s.worktreeBasePath)
  const worktreeSyncPaths = useSessionStore((s) => s.worktreeSyncPaths)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-[10px] uppercase tracking-wide mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
          Default Worktree Base Path
        </label>
        <input
          type="text"
          defaultValue={worktreeBasePath}
          onBlur={(e) => {
            void window.cccAPI.config.update({ worktreeBasePath: e.target.value })
            useSessionStore.setState({ worktreeBasePath: e.target.value })
          }}
          placeholder="~/worktrees"
          className="w-full px-3 py-2 rounded-lg text-xs border outline-none transition-colors duration-100 focus:border-[var(--accent)]"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--bg-raised)', color: 'var(--text-primary)' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Worktrees will be created at this path / repo name / branch name
        </p>
      </div>
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
    </div>
  )
}
