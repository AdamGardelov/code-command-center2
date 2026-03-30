import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../stores/session-store'

function getTerminalTheme(theme: 'dark' | 'light'): Record<string, string> {
  if (theme === 'light') {
    return {
      background: '#fafafa',
      foreground: '#1a1a1a',
      cursor: '#d97706',
      selectionBackground: 'rgba(217, 119, 6, 0.2)',
      black: '#1a1a1a',
      brightBlack: '#555555'
    }
  }
  return {
    background: '#0d0d14',
    foreground: '#cccccc',
    cursor: '#f59e0b',
    selectionBackground: 'rgba(245, 158, 11, 0.2)',
    black: '#0a0a0f',
    brightBlack: '#555555'
  }
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  sessionId: string | null
): void {
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const unsubDataRef = useRef<(() => void) | null>(null)
  const theme = useSessionStore((s) => s.theme)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sessionId) return

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowProposedApi: true,
      theme: getTerminalTheme(theme)
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(container)

    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      terminal.loadAddon(webglAddon)
    } catch {
      // WebGL not available — canvas fallback
    }

    fitAddon.fit()
    termRef.current = terminal
    fitRef.current = fitAddon

    const { cols, rows } = terminal
    window.cccAPI.terminal.resize(sessionId, cols, rows)

    window.cccAPI.session.attach(sessionId)

    const inputDisposable = terminal.onData((data) => {
      window.cccAPI.terminal.write(sessionId, data)
    })

    const unsubData = window.cccAPI.terminal.onData((id, data) => {
      if (id === sessionId) {
        terminal.write(data)
      }
    })
    unsubDataRef.current = unsubData

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      const { cols, rows } = terminal
      window.cccAPI.terminal.resize(sessionId, cols, rows)
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      inputDisposable.dispose()
      if (unsubDataRef.current) unsubDataRef.current()
      window.cccAPI.session.detach(sessionId)
      terminal.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId, containerRef])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getTerminalTheme(theme)
    }
  }, [theme])
}
