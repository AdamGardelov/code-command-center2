import { ipcMain, clipboard } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import type { ConfigService } from '../config-service'

function expandHome(p: string): string {
  if (p.startsWith('~')) return join(homedir(), p.slice(1))
  return p
}

export function registerClipboardIpc(configService: ConfigService): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'clipboard:write-image',
    async (_event, bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string> => {
      const filename = `ccc-paste-${Date.now()}.${ext}`
      const configured = configService.get().screenshotPastePath?.trim()
      let dir = tmpdir()
      if (configured) {
        const expanded = expandHome(configured)
        try {
          await mkdir(expanded, { recursive: true })
          dir = expanded
        } catch (err) {
          console.error('Failed to use configured screenshotPastePath, falling back to tmpdir:', err)
        }
      }
      const filepath = join(dir, filename)
      await writeFile(filepath, Buffer.from(bytes))
      return filepath
    }
  )
}
