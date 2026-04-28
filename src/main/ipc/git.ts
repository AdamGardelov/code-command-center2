import { ipcMain } from 'electron'
import type { GitService } from '../git-service'
import type { WorktreeCreateMode } from '../../shared/types'

export function registerGitIpc(gitService: GitService): void {
  ipcMain.handle('git:list-worktrees', async (_event, repoPath: string, remoteHost?: string, containerName?: string) => {
    return gitService.listWorktrees(repoPath, remoteHost, containerName)
  })

  ipcMain.handle(
    'git:add-worktree',
    async (
      _event,
      repoPath: string,
      branch: string,
      targetPath: string,
      mode: WorktreeCreateMode,
      remoteHost?: string,
      containerName?: string
    ) => {
      const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost, containerName)
      return gitService.addWorktree(repoPath, branch, resolvedPath, mode, remoteHost, containerName)
    }
  )

  ipcMain.handle('git:fetch-remotes', async (_event, repoPath: string, remoteHost?: string, containerName?: string) => {
    return gitService.fetchRemotes(repoPath, remoteHost, containerName)
  })

  ipcMain.handle('git:remove-worktree', async (_event, worktreePath: string, remoteHost?: string, containerName?: string) => {
    return gitService.removeWorktree(worktreePath, remoteHost, containerName)
  })

  ipcMain.handle('git:list-branches', async (_event, repoPath: string, remoteHost?: string, containerName?: string) => {
    return gitService.listBranches(repoPath, remoteHost, containerName)
  })

  ipcMain.handle('git:branch-metadata', async (_event, repoPath: string, remoteHost?: string, containerName?: string) => {
    return gitService.getBranchMetadata(repoPath, remoteHost, containerName)
  })
}
