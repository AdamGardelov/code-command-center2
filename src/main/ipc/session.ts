import { ipcMain, shell } from 'electron'
import type { SessionManager } from '../session-manager'
import type { SessionCreate } from '../../shared/types'

export function registerSessionIpc(sessionManager: SessionManager): void {
  ipcMain.handle('session:list', async () => {
    return sessionManager.list()
  })

  ipcMain.handle('session:create', async (_event, opts: SessionCreate) => {
    return sessionManager.create(opts)
  })

  ipcMain.handle('session:kill', async (_event, id: string) => {
    return sessionManager.kill(id)
  })

  ipcMain.handle('session:open-ide', async (_event, id: string) => {
    sessionManager.openInIde(id)
  })

  ipcMain.handle('session:open-folder', async (_event, id: string) => {
    const sessions = await sessionManager.list()
    const session = sessions.find(s => s.id === id)
    if (session?.workingDirectory) {
      const dir = session.workingDirectory.replace(/^~/, process.env.HOME ?? '')
      await shell.openPath(dir)
    }
  })
}
