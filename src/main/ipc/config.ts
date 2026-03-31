import { ipcMain } from 'electron'
import type { ConfigService } from '../config-service'
import type { CccConfig } from '../../shared/types'

export function registerConfigIpc(configService: ConfigService): void {
  ipcMain.handle('config:load', () => {
    return configService.load()
  })

  ipcMain.handle('config:update', (_event, partial: Partial<CccConfig>) => {
    return configService.update(partial)
  })

  ipcMain.handle('config:toggle-excluded', (_event, sessionName: string) => {
    configService.toggleExcluded(sessionName)
  })
}
