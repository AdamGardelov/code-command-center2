import { Star, X as XIcon, LayoutGrid, Layers } from 'lucide-react'
import type { WorktreeCreateMode } from '../../shared/types'

export interface MultiRepoPreviewProps {
  selectedRepos: string[]
  primaryRepo: string | null
  branch: string
  taskFolder: string
  resolutions: Map<string, WorktreeCreateMode>
  perRepoSessions: boolean
  worktreeBasePath: string
  creationErrors: Map<string, string>
  onSetPrimary: (repo: string) => void
  onRemove: (repo: string) => void
  onSetPerRepo: (perRepo: boolean) => void
  onRetry: (repo: string) => void
}

export default function MultiRepoPreview(props: MultiRepoPreviewProps): React.JSX.Element {
  const {
    selectedRepos, primaryRepo, branch, taskFolder, resolutions, perRepoSessions,
    worktreeBasePath, creationErrors,
    onSetPrimary, onRemove, onSetPerRepo, onRetry,
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
                <span className={`session-flag${perRepoSessions ? '' : ' silent'}`}>
                  <span className="session-flag__pip" />
                  {perRepoSessions
                    ? `session: ${branch} · ${repoName}`
                    : 'worktree only'}
                </span>
              </div>
              <div className="wt-path">
                <span className="seg-base">{worktreeBasePath}/</span>
                <span className="seg-task">{taskFolder || branch}</span>
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
        <div className="mode-cards">
          <label className={`mode-card${!perRepoSessions ? ' selected' : ''}`}>
            <input
              type="radio"
              name="ccc-session-mode"
              checked={!perRepoSessions}
              onChange={() => onSetPerRepo(false)}
            />
            <div className="mode-card__top">
              <span className="mode-card__glyph"><Layers size={12} /></span>
              <span className="mode-card__name">One session, all repos</span>
            </div>
            <p className="mode-card__desc">
              Open the task folder so one agent sees every worktree as a sibling.
            </p>
            <div className="mode-card__stat">
              1 session · {selectedRepos.length} worktrees
            </div>
          </label>
          <label className={`mode-card${perRepoSessions ? ' selected' : ''}`}>
            <input
              type="radio"
              name="ccc-session-mode"
              checked={perRepoSessions}
              onChange={() => onSetPerRepo(true)}
            />
            <div className="mode-card__top">
              <span className="mode-card__glyph"><LayoutGrid size={12} /></span>
              <span className="mode-card__name">One session per repo</span>
            </div>
            <p className="mode-card__desc">
              Spawn an isolated agent in each repo. Same task folder, separate contexts.
            </p>
            <div className="mode-card__stat">
              {selectedRepos.length} sessions · {selectedRepos.length} worktrees
            </div>
          </label>
        </div>
      </div>
    </aside>
  )
}
