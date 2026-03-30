import { ipcMain } from 'electron'
import type { SshService } from '../ssh-service'

export function registerHostIpc(sshService: SshService): void {
  ipcMain.handle('host:statuses', () => {
    return sshService.getStatuses()
  })
}
