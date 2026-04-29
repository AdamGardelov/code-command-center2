import { useEffect } from 'react'
import Layout from './components/Layout'
import ToastContainer from './components/ToastContainer'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionStore } from './stores/session-store'
import { useUpdaterStore } from './stores/updater-store'

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

    // Push-based refresh from tmux control mode. Falls back to a slow poll for
    // safety in case the control connection is briefly unavailable.
    const unsubList = window.cccAPI.session.onListChanged(() => {
      loadSessions()
    })
    const interval = setInterval(loadSessions, 30000)

    const unsubState = window.cccAPI.state.onStateChanged((sessionName, status) => {
      updateSessionStatus(sessionName, status)
    })

    const unsubHost = window.cccAPI.host.onStatusChanged((name, online) => {
      updateHostStatus(name, online)
    })

    return () => {
      clearInterval(interval)
      unsubList()
      unsubState()
      unsubHost()
    }
  }, [loadSessions, updateSessionStatus, loadHostStatuses, updateHostStatus])

  useEffect(() => {
    void window.cccAPI.updater.getState().then((state) => {
      useUpdaterStore.getState().setState(state)
    })
    const unsubscribe = window.cccAPI.updater.onStateChanged((state) => {
      useUpdaterStore.getState().setState(state)
    })
    return unsubscribe
  }, [])

  return (
    <>
      <Layout />
      <ToastContainer />
    </>
  )
}
