import { useEffect } from 'react'
import Layout from './components/Layout'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  useKeyboard()

  const loadSessions = useSessionStore((s) => s.loadSessions)
  const updateSessionStatus = useSessionStore((s) => s.updateSessionStatus)

  useEffect(() => {
    loadSessions()

    const interval = setInterval(loadSessions, 5000)

    const unsubState = window.cccAPI.state.onStateChanged((sessionName, status) => {
      updateSessionStatus(sessionName, status)
    })

    return () => {
      clearInterval(interval)
      unsubState()
    }
  }, [loadSessions, updateSessionStatus])

  return <Layout />
}
