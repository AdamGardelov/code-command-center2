import { ipcMain, shell } from 'electron'

export function registerShellIpc(): void {
  ipcMain.on('shell:open-external', (_event, url: string) => {
    shell.openExternal(url)
  })
}
