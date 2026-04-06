import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron'

// macOS GUI apps don't inherit shell PATH — add common Homebrew paths
if (process.platform === 'darwin') {
  const extra = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin']
  const current = process.env.PATH ?? ''
  const missing = extra.filter(p => !current.split(':').includes(p))
  if (missing.length) {
    process.env.PATH = [...missing, current].join(':')
  }
}

// Set WM_CLASS (X11) and app_id (Wayland) for Linux taskbar icon mapping
if (process.platform === 'linux') {
  app.setName('code-command-center')
  app.commandLine.appendSwitch('class', 'code-command-center')
  ;(app as unknown as { desktopName: string }).desktopName = 'code-command-center.desktop'
}

// Enable proper font rendering
app.commandLine.appendSwitch('force-color-profile', 'srgb')
app.commandLine.appendSwitch('enable-lcd-text')

// Native Wayland support with fractional scaling (no-op on X11/macOS/Windows)
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch('enable-features', 'WaylandFractionalScaleV1')
app.commandLine.appendSwitch('enable-wayland-ime')
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SessionManager } from './session-manager'
import { PtyManager } from './pty-manager'
import { StateDetector } from './state-detector'
import { registerSessionIpc } from './ipc/session'
import { registerTerminalIpc } from './ipc/terminal'
import { registerConfigIpc } from './ipc/config'
import { registerHostIpc } from './ipc/host'
import { ConfigService } from './config-service'
import { SshService } from './ssh-service'
import { GitService } from './git-service'
import { registerGitIpc } from './ipc/git'
import { registerGroupIpc } from './ipc/group'
import { registerClipboardIpc } from './ipc/clipboard'
import { registerShellIpc } from './ipc/shell'
import { registerUpdaterIpc } from './ipc/updater'
import { NotificationService } from './notification-service'
import { PrService } from './pr-service'
import { ContainerService } from './container-service'
import { initUpdater } from './updater'
import { log, readLogs, getLogPath } from './log-service'

const configService = new ConfigService()
configService.load()

const sshService = new SshService()

const gitService = new GitService()
gitService.setSshService(sshService)
gitService.setConfigService(configService)

const sessionManager = new SessionManager()
sessionManager.setConfigService(configService)
sessionManager.setSshService(sshService)
const ptyManager = new PtyManager()
const stateDetector = new StateDetector()
const notificationService = new NotificationService(configService)
const prService = new PrService(configService)

const containerService = new ContainerService()
containerService.setSshService(sshService)
containerService.setConfigService(configService)

const isMac = process.platform === 'darwin'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    ...(isMac ? { trafficLightPosition: { x: 12, y: 10 } } : {}),
    backgroundColor: '#0a0a0f',
    icon: nativeImage.createFromPath(join(__dirname, '../../build/icon.png')),
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
  notificationService.setWindow(mainWindow)
  prService.setWindow(mainWindow)
  if (configService.get().features.pullRequests) {
    prService.start()
  }
  sshService.setWindow(mainWindow)

  const remoteHosts = configService.get().remoteHosts ?? []
  if (remoteHosts.length > 0) {
    sshService.startMonitoring(remoteHosts)
  }

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
    notificationService.handleStatusChange(session.name, status, session.color)
  }
})

registerSessionIpc(sessionManager)
registerTerminalIpc(ptyManager, sessionManager, stateDetector)
registerConfigIpc(configService)
registerHostIpc(sshService)
registerGitIpc(gitService)
registerGroupIpc(configService)
registerClipboardIpc()
registerShellIpc()
registerUpdaterIpc()

ipcMain.handle('container:list-running', (_event, remoteHost?: string) => {
  return containerService.listRunning(remoteHost)
})

ipcMain.on('pr:refresh', () => {
  void prService.refresh()
})

ipcMain.handle('pr:get-state', () => {
  return prService.getState()
})

ipcMain.handle('app:platform', () => process.platform)

ipcMain.handle('app:logs', (_event, lines?: number) => readLogs(lines))

ipcMain.handle('app:log-path', () => getLogPath())

// Hook-based detection as secondary source (overrides OSC if configured)
stateDetector.start()

app.whenReady().then(() => {
  log.info(`CCC starting on ${process.platform} (${process.arch})`)

  const deps = sessionManager.checkDependencies()
  if (!deps.tmux) {
    const installHint = isMac
      ? 'brew install tmux'
      : 'sudo apt install tmux'
    log.error(`tmux is not installed. Install with: ${installHint}`)
    console.error(`tmux is not installed. Install with: ${installHint}`)
  }

  createWindow()

  if (!is.dev) {
    initUpdater()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  sshService.stopMonitoring()
  stateDetector.stop()
  ptyManager.detachAll()
  prService.stop()
  if (process.platform !== 'darwin') app.quit()
})
