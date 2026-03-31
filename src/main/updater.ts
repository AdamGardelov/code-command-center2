import { autoUpdater } from 'electron-updater'
import { dialog, BrowserWindow } from 'electron'

export function initUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    const win = BrowserWindow.getFocusedWindow()
    dialog
      .showMessageBox({
        ...(win ? { window: win } : {}),
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Update now?`,
        buttons: ['Update', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getFocusedWindow()
    dialog
      .showMessageBox({
        ...(win ? { window: win } : {}),
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. Restart now to install?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  // Check on startup (with delay to not slow down launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('Update check failed:', err.message)
    })
  }, 10000)

  // Check every 4 hours
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Update check failed:', err.message)
      })
    },
    4 * 60 * 60 * 1000
  )
}
