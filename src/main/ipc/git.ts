import { ipcMain } from 'electron'
import type { GitService } from '../git-service'
import type { WorktreeCreateMode } from '../../shared/types'

export function registerGitIpc(gitService: GitService): void {
  ipcMain.handle('git:list-worktrees', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.listWorktrees(repoPath, remoteHost)
  })

  ipcMain.handle(
    'git:add-worktree',
    async (
      _event,
      repoPath: string,
      branch: string,
      targetPath: string,
      mode?: WorktreeCreateMode,
      remoteHost?: string
    ) => {
      const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost)
      return gitService.addWorktree(repoPath, branch, resolvedPath, mode, remoteHost)
    }
  )

  ipcMain.handle('git:fetch-remotes', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.fetchRemotes(repoPath, remoteHost)
  })

  ipcMain.handle('git:remove-worktree', async (_event, worktreePath: string, remoteHost?: string) => {
    return gitService.removeWorktree(worktreePath, remoteHost)
  })

  ipcMain.handle('git:list-branches', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.listBranches(repoPath, remoteHost)
  })

  ipcMain.handle('git:branch-metadata', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.getBranchMetadata(repoPath, remoteHost)
  })
}
