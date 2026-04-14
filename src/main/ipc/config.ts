import { ipcMain } from 'electron'
import type { ConfigService } from '../config-service'
import type { SshService } from '../ssh-service'
import type { CccConfig } from '../../shared/types'

export function registerConfigIpc(configService: ConfigService, sshService?: SshService): void {
  ipcMain.handle('config:load', () => {
    return configService.load()
  })

  ipcMain.handle('config:update', (_event, partial: Partial<CccConfig>) => {
    const result = configService.update(partial)
    if (partial.remoteHosts !== undefined && sshService) {
      const hosts = result.remoteHosts ?? []
      if (hosts.length > 0) {
        sshService.startMonitoring(hosts)
      } else {
        sshService.stopMonitoring()
      }
    }
    return result
  })

  ipcMain.handle('config:toggle-excluded', (_event, sessionName: string) => {
    configService.toggleExcluded(sessionName)
  })

  ipcMain.handle('config:toggle-muted', (_event, sessionName: string) => {
    configService.toggleMuted(sessionName)
  })

  ipcMain.handle('config:toggle-archived', (_event, sessionName: string) => {
    configService.toggleArchived(sessionName)
  })

  ipcMain.handle('config:set-display-name', (_event, sessionName: string, displayName: string) => {
    configService.setDisplayName(sessionName, displayName)
  })
}
