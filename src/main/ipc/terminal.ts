import { ipcMain } from 'electron'
import type { PtyManager } from '../pty-manager'
import type { SessionManager } from '../session-manager'
import type { StateDetector } from '../state-detector'

export function registerTerminalIpc(
  ptyManager: PtyManager,
  sessionManager: SessionManager,
  stateDetector: StateDetector
): void {
  ipcMain.on('session:attach', (_event, id: string) => {
    const tmuxName = sessionManager.getTmuxName(id)
    if (tmuxName) {
      ptyManager.attach(id, tmuxName)
    }
  })

  ipcMain.on('session:detach', (_event, id: string) => {
    ptyManager.detach(id)
  })

  ipcMain.on('terminal:write', (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data)
  })

  ipcMain.on('terminal:resize', (_event, sessionId: string, cols: number, rows: number) => {
    ptyManager.resize(sessionId, cols, rows)
  })

  ipcMain.on('terminal:content-snapshot', (_event, sessionName: string, lastLine: string) => {
    stateDetector.analyzeContent(sessionName, lastLine)
  })
}
