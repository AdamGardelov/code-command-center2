import { contextBridge, ipcRenderer } from 'electron'
import type { CccAPI, CccConfig, SessionCreate, SessionStatus } from '../shared/types'

const api: CccAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  },
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    create: (opts: SessionCreate) => ipcRenderer.invoke('session:create', opts),
    kill: (id: string) => ipcRenderer.invoke('session:kill', id),
    attach: (id: string, cols?: number, rows?: number) => ipcRenderer.send('session:attach', id, cols, rows),
    detach: (id: string) => ipcRenderer.send('session:detach', id)
  },
  terminal: {
    write: (sessionId: string, data: string) =>
      ipcRenderer.send('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', sessionId, cols, rows),
    onData: (callback: (sessionId: string, data: string) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        sessionId: string,
        data: string
      ): void => {
        callback(sessionId, data)
      }
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    }
  },
  state: {
    onStateChanged: (callback: (sessionId: string, status: SessionStatus) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        sessionId: string,
        status: SessionStatus
      ): void => {
        callback(sessionId, status)
      }
      ipcRenderer.on('session:state-changed', handler)
      return () => ipcRenderer.removeListener('session:state-changed', handler)
    }
  },
  config: {
    load: (): Promise<CccConfig> => ipcRenderer.invoke('config:load'),
    update: (partial: Partial<CccConfig>): Promise<CccConfig> => ipcRenderer.invoke('config:update', partial)
  },
  host: {
    statuses: () => ipcRenderer.invoke('host:statuses'),
    onStatusChanged: (callback: (name: string, online: boolean) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        name: string,
        online: boolean
      ): void => {
        callback(name, online)
      }
      ipcRenderer.on('host:status-changed', handler)
      return () => ipcRenderer.removeListener('host:status-changed', handler)
    }
  }
}

contextBridge.exposeInMainWorld('cccAPI', api)
