import { app, BrowserWindow, ipcMain, shell } from 'electron'

// Enable proper font rendering
app.commandLine.appendSwitch('force-color-profile', 'srgb')
app.commandLine.appendSwitch('enable-lcd-text')
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { PtyManager } from './pty-manager'
import { StateDetector } from './state-detector'
import { registerSessionIpc } from './ipc/session'
import { registerTerminalIpc } from './ipc/terminal'
import { registerConfigIpc } from './ipc/config'
import { ConfigService } from './config-service'

const configService = new ConfigService()
configService.load()

const sessionManager = new SessionManager()
sessionManager.setConfigService(configService)
const ptyManager = new PtyManager()
const stateDetector = new StateDetector()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  ptyManager.setWindow(mainWindow)
  stateDetector.setWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    ptyManager.detachAll()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('window:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win?.isMaximized()) win.unmaximize()
  else win?.maximize()
})
ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close())

// OSC-based status detection updates session manager
ptyManager.setStatusChangeHandler((sessionId, status) => {
  const session = sessionManager.getById(sessionId)
  if (session) {
    sessionManager.updateStatus(session.name, status)
  }
})

registerSessionIpc(sessionManager)
registerTerminalIpc(ptyManager, sessionManager, stateDetector)
registerConfigIpc(configService)

// Hook-based detection as secondary source (overrides OSC if configured)
stateDetector.start()

app.whenReady().then(() => {
  const deps = sessionManager.checkDependencies()
  if (!deps.tmux) {
    console.error('tmux is not installed. Install with: sudo apt install tmux')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stateDetector.stop()
  ptyManager.detachAll()
  if (process.platform !== 'darwin') app.quit()
})
