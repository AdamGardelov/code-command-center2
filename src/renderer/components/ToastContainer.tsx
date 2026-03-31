import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '../stores/session-store'

interface Toast {
  id: number
  sessionName: string
  message: string
  color: string
  exiting: boolean
}

let nextId = 0

export default function ToastContainer(): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])
  const sessions = useSessionStore((s) => s.sessions)
  const setActiveSession = useSessionStore((s) => s.setActiveSession)
  const setViewMode = useSessionStore((s) => s.setViewMode)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 200)
  }, [])

  const handleClick = useCallback((sessionName: string, id: number) => {
    const session = sessions.find((s) => s.name === sessionName)
    if (session) {
      setActiveSession(session.id)
      setViewMode('single')
    }
    dismiss(id)
  }, [sessions, setActiveSession, setViewMode, dismiss])

  const navigateToSession = useCallback((sessionName: string) => {
    const session = sessions.find((s) => s.name === sessionName)
    if (session) {
      setActiveSession(session.id)
      setViewMode('single')
    }
  }, [sessions, setActiveSession, setViewMode])

  useEffect(() => {
    const unsubToast = window.cccAPI.notification.onToast((data) => {
      const id = nextId++
      setToasts((prev) => {
        const next = [...prev, { ...data, id, exiting: false }]
        if (next.length > 3) {
          return next.slice(next.length - 3)
        }
        return next
      })
      setTimeout(() => dismiss(id), 5000)
    })

    const unsubNav = window.cccAPI.notification.onNavigate((sessionName) => {
      navigateToSession(sessionName)
    })

    return () => {
      unsubToast()
      unsubNav()
    }
  }, [dismiss, navigateToSession])

  if (toasts.length === 0) return <></>

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          onClick={() => handleClick(toast.sessionName, toast.id)}
          className="flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200 hover:brightness-110 cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--bg-raised)',
            borderLeftWidth: 3,
            borderLeftColor: toast.color,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            opacity: toast.exiting ? 0 : 1,
            transform: toast.exiting ? 'translateX(100%)' : 'translateX(0)',
            minWidth: 240
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: toast.color }}
          />
          <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
            {toast.message}
          </span>
        </button>
      ))}
    </div>
  )
}
