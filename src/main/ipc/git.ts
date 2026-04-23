import { ipcMain } from 'electron'
import type { GitService } from '../git-service'

export function registerGitIpc(gitService: GitService): void {
  ipcMain.handle('git:list-worktrees', async (_event, repoPath: string, remoteHost?: string) => {
    return gitService.listWorktrees(repoPath, remoteHost)
  })

  ipcMain.handle('git:add-worktree', async (_event, repoPath: string, branch: string, targetPath: string, remoteHost?: string) => {
    const resolvedPath = targetPath || gitService.resolveWorktreePath(repoPath, branch, remoteHost)
    return gitService.addWorktree(repoPath, branch, resolvedPath, remoteHost)
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
