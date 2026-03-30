import { useEffect } from 'react'
import { useSessionStore } from '../stores/session-store'

export function useKeyboard(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        useSessionStore.getState().toggleModal()
        return
      }

      if (mod && e.key === 'w') {
        e.preventDefault()
        const { activeSessionId, removeSession } = useSessionStore.getState()
        if (activeSessionId) void removeSession(activeSessionId)
        return
      }

      if (mod && e.key === 'g') {
        e.preventDefault()
        const { viewMode, setViewMode } = useSessionStore.getState()
        setViewMode(viewMode === 'single' ? 'grid' : 'single')
        return
      }

      if (mod && e.key === 't') {
        e.preventDefault()
        useSessionStore.getState().toggleTheme()
        return
      }

      if (mod && e.key === 'b') {
        e.preventDefault()
        useSessionStore.getState().toggleSidebar()
        return
      }

      if (mod && e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          useSessionStore.getState().prevSession()
        } else {
          useSessionStore.getState().nextSession()
        }
        return
      }

      if (mod && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const { sessions, setActiveSession } = useSessionStore.getState()
        if (idx < sessions.length) {
          setActiveSession(sessions[idx].id)
        }
        return
      }

      if (e.key === 'Escape') {
        const { modalOpen, toggleModal, settingsOpen, toggleSettings } = useSessionStore.getState()
        if (settingsOpen) {
          e.preventDefault()
          toggleSettings()
        } else if (modalOpen) {
          e.preventDefault()
          toggleModal()
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
