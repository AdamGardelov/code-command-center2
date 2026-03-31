import { useEffect } from 'react'
import Layout from './components/Layout'
import ToastContainer from './components/ToastContainer'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionStore } from './stores/session-store'

export default function App(): React.JSX.Element {
  useKeyboard()

  const loadConfig = useSessionStore((s) => s.loadConfig)
  const loadSessions = useSessionStore((s) => s.loadSessions)
  const updateSessionStatus = useSessionStore((s) => s.updateSessionStatus)
  const loadHostStatuses = useSessionStore((s) => s.loadHostStatuses)
  const updateHostStatus = useSessionStore((s) => s.updateHostStatus)

  useEffect(() => {
    loadConfig().then(() => {
      loadSessions()
      loadHostStatuses()
    })

    const interval = setInterval(loadSessions, 5000)

    const unsubState = window.cccAPI.state.onStateChanged((sessionName, status) => {
      updateSessionStatus(sessionName, status)
    })

    const unsubHost = window.cccAPI.host.onStatusChanged((name, online) => {
      updateHostStatus(name, online)
    })

    return () => {
      clearInterval(interval)
      unsubState()
      unsubHost()
    }
  }, [loadSessions, updateSessionStatus, loadHostStatuses, updateHostStatus])

  return (
    <>
      <Layout />
      <ToastContainer />
    </>
  )
}
