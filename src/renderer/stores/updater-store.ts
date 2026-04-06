import { create } from 'zustand'
import type { UpdaterState, UpdaterInstallResult } from '../../shared/types'

interface UpdaterStore {
  state: UpdaterState
  setState: (state: UpdaterState) => void
  check: () => Promise<void>
  install: () => Promise<UpdaterInstallResult>
}

const initialState: UpdaterState = {
  status: 'idle',
  currentVersion: ''
}

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  state: initialState,
  setState: (state) => set({ state }),
  check: async () => {
    const next = await window.cccAPI.updater.check()
    set({ state: next })
  },
  install: async () => {
    return window.cccAPI.updater.install()
  }
}))
