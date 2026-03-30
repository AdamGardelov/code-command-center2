import { ipcMain } from 'electron'
import type { ConfigService } from '../config-service'
import type { SessionGroup } from '../../shared/types'

export function registerGroupIpc(configService: ConfigService): void {
  ipcMain.handle('group:create', async (_event, name: string): Promise<SessionGroup> => {
    const config = configService.get()
    const group: SessionGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      sessionIds: []
    }
    configService.update({
      sessionGroups: [...(config.sessionGroups ?? []), group]
    })
    return group
  })

  ipcMain.handle('group:delete', async (_event, groupId: string): Promise<void> => {
    const config = configService.get()
    configService.update({
      sessionGroups: (config.sessionGroups ?? []).filter(g => g.id !== groupId)
    })
  })

  ipcMain.handle('group:add-session', async (_event, groupId: string, sessionId: string): Promise<void> => {
    const config = configService.get()
    const groups = (config.sessionGroups ?? []).map(g => {
      if (g.id === groupId && !g.sessionIds.includes(sessionId)) {
        return { ...g, sessionIds: [...g.sessionIds, sessionId] }
      }
      return g
    })
    configService.update({ sessionGroups: groups })
  })

  ipcMain.handle('group:remove-session', async (_event, groupId: string, sessionId: string): Promise<void> => {
    const config = configService.get()
    const groups = (config.sessionGroups ?? []).map(g => {
      if (g.id === groupId) {
        return { ...g, sessionIds: g.sessionIds.filter(id => id !== sessionId) }
      }
      return g
    })
    configService.update({ sessionGroups: groups })
  })
}
