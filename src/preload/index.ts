import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { CccAPI, CccConfig, SessionCreate, SessionStatus, SessionGroup, ContainerConfig, UpdaterState } from '../shared/types'

const api: CccAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor)
  },
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    create: (opts: SessionCreate) => ipcRenderer.invoke('session:create', opts),
    kill: (id: string) => ipcRenderer.invoke('session:kill', id),
    attach: (id: string, cols?: number, rows?: number) => ipcRenderer.send('session:attach', id, cols, rows),
    detach: (id: string) => ipcRenderer.send('session:detach', id),
    openInIde: (id: string): Promise<void> => ipcRenderer.invoke('session:open-ide', id),
    openFolder: (id: string): Promise<void> => ipcRenderer.invoke('session:open-folder', id)
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
    update: (partial: Partial<CccConfig>): Promise<CccConfig> => ipcRenderer.invoke('config:update', partial),
    toggleExcluded: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-excluded', sessionName),
    toggleMuted: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-muted', sessionName),
    toggleArchived: (sessionName: string): Promise<void> => ipcRenderer.invoke('config:toggle-archived', sessionName),
    setDisplayName: (sessionName: string, displayName: string): Promise<void> => ipcRenderer.invoke('config:set-display-name', sessionName, displayName)
  },
  notification: {
    onToast: (callback: (data: { sessionName: string; message: string; color: string }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: { sessionName: string; message: string; color: string }
      ): void => {
        callback(data)
      }
      ipcRenderer.on('notification:toast', handler)
      return () => ipcRenderer.removeListener('notification:toast', handler)
    },
    onNavigate: (callback: (sessionName: string) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        sessionName: string
      ): void => {
        callback(sessionName)
      }
      ipcRenderer.on('notification:navigate', handler)
      return () => ipcRenderer.removeListener('notification:navigate', handler)
    }
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
  },
  git: {
    listWorktrees: (repoPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:list-worktrees', repoPath, remoteHost),
    addWorktree: (repoPath: string, branch: string, targetPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:add-worktree', repoPath, branch, targetPath, remoteHost),
    removeWorktree: (worktreePath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:remove-worktree', worktreePath, remoteHost),
    listBranches: (repoPath: string, remoteHost?: string) =>
      ipcRenderer.invoke('git:list-branches', repoPath, remoteHost)
  },
  group: {
    create: (name: string): Promise<SessionGroup> => ipcRenderer.invoke('group:create', name),
    delete: (groupId: string): Promise<void> => ipcRenderer.invoke('group:delete', groupId),
    addSession: (groupId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('group:add-session', groupId, sessionId),
    removeSession: (groupId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('group:remove-session', groupId, sessionId)
  },
  pr: {
    getState: (): Promise<Partial<import('../shared/types').PrState>> =>
      ipcRenderer.invoke('pr:get-state'),
    onState: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]): void => {
        callback(state)
      }
      ipcRenderer.on('pr:state', handler)
      return () => ipcRenderer.removeListener('pr:state', handler)
    },
    refresh: () => ipcRenderer.send('pr:refresh'),
    onNavigate: (callback) => {
      const handler = (_event: Electron.IpcRendererEvent): void => {
        callback()
      }
      ipcRenderer.on('pr:navigate', handler)
      return () => ipcRenderer.removeListener('pr:navigate', handler)
    }
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.send('clipboard:write-text', text)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.send('shell:open-external', url)
  },
  container: {
    listRunning: (remoteHost?: string): Promise<ContainerConfig[]> =>
      ipcRenderer.invoke('container:list-running', remoteHost)
  },
  app: {
    platform: (): Promise<string> => ipcRenderer.invoke('app:platform'),
    logs: (lines?: number): Promise<string> => ipcRenderer.invoke('app:logs', lines),
    logPath: (): Promise<string> => ipcRenderer.invoke('app:log-path')
  },
  updater: {
    getState: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:get-state'),
    check: (): Promise<UpdaterState> => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStateChanged: (callback: (state: UpdaterState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: UpdaterState): void => {
        callback(state)
      }
      ipcRenderer.on('updater:state-changed', handler)
      return () => ipcRenderer.removeListener('updater:state-changed', handler)
    }
  }
}

contextBridge.exposeInMainWorld('cccAPI', api)
