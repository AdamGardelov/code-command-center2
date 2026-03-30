import { ipcMain } from 'electron'
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
}
