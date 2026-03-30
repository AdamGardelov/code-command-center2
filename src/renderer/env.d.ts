import type { CccAPI } from '../shared/types'

declare global {
  interface Window {
    cccAPI: CccAPI
  }
}
