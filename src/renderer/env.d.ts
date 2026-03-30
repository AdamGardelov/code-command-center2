import type { CccAPI } from '../shared/types'

declare module '*.png' {
  const src: string
  export default src
}

declare global {
  interface Window {
    cccAPI: CccAPI
  }
}
