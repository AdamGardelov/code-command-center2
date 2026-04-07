import { ipcMain, clipboard } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, posix } from 'node:path'
import type { ConfigService } from '../config-service'

function expandHome(p: string): string {
  if (p.startsWith('~')) return join(homedir(), p.slice(1))
  return p
}

const DEFAULT_DIR = join(homedir(), '.ccc', 'paste')

export function registerClipboardIpc(configService: ConfigService): void {
  ipcMain.on('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'clipboard:write-image',
    async (_event, bytes: Uint8Array, ext: 'png' | 'jpg'): Promise<string> => {
      const filename = `ccc-paste-${Date.now()}.${ext}`
      const cfg = configService.get()
      const hostDir = expandHome((cfg.screenshotPasteHostDir?.trim() || DEFAULT_DIR))
      const sessionDir = cfg.screenshotPasteSessionDir?.trim() || hostDir

      await mkdir(hostDir, { recursive: true })
      await writeFile(join(hostDir, filename), Buffer.from(bytes))

      // Session path uses posix joins so it's valid inside a linux container
      return posix.join(sessionDir, filename)
    }
  )
}
