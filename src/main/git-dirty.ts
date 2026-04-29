import { execFileSync } from 'child_process'

/**
 * True if `git status --porcelain` reports any modifications, untracked files,
 * or staged-but-uncommitted changes in the given working directory. Returns
 * false for non-git paths and on any git failure (timeout, missing binary) —
 * the sidebar treats unknown as "clean enough" rather than surfacing noise.
 */
export function isGitDirty(dir: string): boolean {
  try {
    const expanded = dir.replace(/^~/, process.env.HOME ?? '')
    const out = execFileSync('git', ['-C', expanded, 'status', '--porcelain'], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return out.trim().length > 0
  } catch {
    return false
  }
}
