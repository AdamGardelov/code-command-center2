export interface Session {
  id: string
  name: string
  workingDirectory: string
  status: 'running' | 'stopped' | 'error'
  createdAt: number
  lastActiveAt: number
}

export interface SessionCreate {
  name: string
  workingDirectory: string
}

export type ViewMode = 'single' | 'grid'

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface CccAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
}
