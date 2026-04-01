import { ipcMain, clipboard } from 'electron'

export function registerClipboardIpc(): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })
}
