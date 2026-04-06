import { ipcMain } from 'electron'
import { getUpdater } from '../updater'

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:get-state', () => {
    return getUpdater().getState()
  })

  ipcMain.handle('updater:check', async () => {
    return getUpdater().check()
  })

  ipcMain.handle('updater:install', () => {
    return getUpdater().install()
  })
}
