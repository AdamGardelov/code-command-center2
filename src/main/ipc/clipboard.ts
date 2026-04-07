import { ipcMain, clipboard } from 'electron'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function registerClipboardIpc(): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'clipboard:write-image',
    async (_event, bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string> => {
      const filename = `ccc-paste-${Date.now()}.${ext}`
      const filepath = join(tmpdir(), filename)
      await writeFile(filepath, Buffer.from(bytes))
      return filepath
    }
  )
}
