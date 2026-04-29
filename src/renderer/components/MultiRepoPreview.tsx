import { Star, X as XIcon, LayoutGrid } from 'lucide-react'
import type { WorktreeCreateMode } from '../../shared/types'

export interface MultiRepoPreviewProps {
  selectedRepos: string[]
  primaryRepo: string | null
  branch: string
  resolutions: Map<string, WorktreeCreateMode>
  perRepoSessions: boolean
  worktreeBasePath: string
  creationErrors: Map<string, string>
  onSetPrimary: (repo: string) => void
  onRemove: (repo: string) => void
  onTogglePerRepo: () => void
  onRetry: (repo: string) => void
}

export default function MultiRepoPreview(props: MultiRepoPreviewProps): React.JSX.Element {
  const {
    selectedRepos, primaryRepo, branch, resolutions, perRepoSessions,
    worktreeBasePath, creationErrors,
    onSetPrimary, onRemove, onTogglePerRepo, onRetry,
  } = props

  const repoLeaf = (p: string): string => p.split('/').filter(Boolean).pop() ?? p

  return (
    <aside className="ccc-multi-rail">
      <div className="ccc-multi-rail__head">
        <h2>Task preview</h2>
        <span className="ccc-multi-rail__count">{selectedRepos.length} repos</span>
      </div>

      <div className="ccc-multi-rail__body ccc-scroll">
        {selectedRepos.map((repoPath) => {
          const isPrimary = repoPath === primaryRepo
          const mode = resolutions.get(repoPath)
          const err = creationErrors.get(repoPath)
          const repoName = repoLeaf(repoPath)
          return (
            <div key={repoPath} className={`repo-card${isPrimary ? ' primary' : ''}${err ? ' has-error' : ''}`}>
              <div className="repo-card__row1">
                <span className="repo-card__name">{repoName}</span>
                <button
                  className="repo-card__star"
                  type="button"
                  disabled={perRepoSessions}
                  onClick={() => onSetPrimary(repoPath)}
                  title={isPrimary ? 'Primary' : 'Make primary'}
                >
                  <Star size={11} fill={isPrimary ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="repo-card__rm"
                  type="button"
                  onClick={() => onRemove(repoPath)}
                  title="Remove"
                >
                  <XIcon size={11} />
                </button>
              </div>
              <div className="repo-card__meta">
                <span className={`resolution resolution--${mode ?? 'unknown'}`}>
                  {mode === 'new-branch' && '+ new branch'}
                  {mode === 'existing-local' && 'checkout existing'}
                  {mode === 'track-remote' && `track origin/${branch}`}
                  {!mode && '…'}
                </span>
                <span className={`session-flag${perRepoSessions || isPrimary ? '' : ' silent'}`}>
                  <span className="session-flag__pip" />
                  {perRepoSessions
                    ? `session: ${branch} · ${repoName}`
                    : isPrimary ? 'session here' : 'worktree only'}
                </span>
              </div>
              <div className="wt-path">
                <span className="seg-base">{worktreeBasePath}/</span>
                <span className="seg-branch">{branch}</span>
                <span className="seg-base">/</span>
                <span className="seg-repo">{repoName}</span>
              </div>
              {err && (
                <div className="repo-card__err">
                  <span>{err}</span>
                  <button type="button" onClick={() => onRetry(repoPath)}>Retry</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="ccc-multi-rail__mode">
        <button
          type="button"
          className={`tg${perRepoSessions ? ' on' : ''}`}
          onClick={onTogglePerRepo}
        >
          <span className="sw" />
          <span className="lbl-text">
            <LayoutGrid size={11} />
            Spawn one session per repo
          </span>
        </button>
        <div className="ccc-multi-rail__summary">
          {perRepoSessions ? (
            <><b>{selectedRepos.length} worktrees</b> + <b>{selectedRepos.length} sessions</b> grouped as <b>{branch}</b></>
          ) : (
            <><b>{selectedRepos.length} worktrees</b>, <b>1 session</b> in <b>{primaryRepo ? repoLeaf(primaryRepo) : '—'}</b></>
          )}
        </div>
      </div>
    </aside>
  )
}
