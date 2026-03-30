import { contextBridge, ipcRenderer } from 'electron'
import type { CccAPI } from '../shared/types'

const api: CccAPI = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
}

contextBridge.exposeInMainWorld('cccAPI', api)
