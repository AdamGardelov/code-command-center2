import { Notification, BrowserWindow } from 'electron'
import type { SessionStatus } from '../shared/types'
import type { ConfigService } from './config-service'

interface NotificationTarget {
  sessionName: string
  message: string
  color: string
}

export class NotificationService {
  private configService: ConfigService
  private window: BrowserWindow | null = null
  private lastStatus: Map<string, SessionStatus> = new Map()

  constructor(configService: ConfigService) {
    this.configService = configService
  }

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  handleStatusChange(sessionName: string, status: SessionStatus, color: string): void {
    const prev = this.lastStatus.get(sessionName)
    this.lastStatus.set(sessionName, status)

    if (prev !== 'working') return

    const config = this.configService.get()
    if (!config.notificationsEnabled) return
    if (config.mutedSessions.includes(sessionName)) return

    let target: NotificationTarget | null = null

    if (status === 'idle') {
      target = { sessionName, message: `${sessionName} is done`, color }
    } else if (status === 'waiting') {
      target = { sessionName, message: `${sessionName} needs input`, color }
    }

    if (!target) return

    if (this.window && !this.window.isDestroyed() && this.window.isFocused()) {
      this.window.webContents.send('notification:toast', target)
    } else {
      const notification = new Notification({
        title: target.message,
        body: status === 'waiting' ? 'Session is waiting for input' : 'Session finished working'
      })
      notification.on('click', () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show()
          this.window.focus()
          this.window.webContents.send('notification:navigate', sessionName)
        }
      })
      notification.show()
    }
  }
}
