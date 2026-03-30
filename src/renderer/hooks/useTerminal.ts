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
      red: '#dc2626',
      green: '#059669',
      yellow: '#d97706',
      blue: '#2563eb',
      magenta: '#9333ea',
      cyan: '#0891b2',
      white: '#555555',
      brightBlack: '#999999',
      brightRed: '#ef4444',
      brightGreen: '#10b981',
      brightYellow: '#f59e0b',
      brightBlue: '#3b82f6',
      brightMagenta: '#a855f7',
      brightCyan: '#06b6d4',
      brightWhite: '#1a1a1a'
    }
  }
  // Ghostty "StyleDark" default theme
  return {
    background: '#292c33',
    foreground: '#ffffff',
    cursor: '#ffffff',
    cursorAccent: '#363a43',
    selectionBackground: '#ffffff',
    selectionForeground: '#292c33',
    black: '#1d1f21',
    red: '#bf6b69',
    green: '#b7bd73',
    yellow: '#e9c880',
    blue: '#88a1bb',
    magenta: '#ad95b8',
    cyan: '#95bdb7',
    white: '#c5c8c6',
    brightBlack: '#666666',
    brightRed: '#c55757',
    brightGreen: '#bcc95f',
    brightYellow: '#e1c65e',
    brightBlue: '#83a5d6',
    brightMagenta: '#bc99d4',
    brightCyan: '#83beb1',
    brightWhite: '#eaeaea'
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

    // Set all parent backgrounds to match xterm exactly (avoids fractional pixel gaps)
    const bg = getTerminalTheme(theme).background
    container.style.backgroundColor = bg
    const outerPanel = container.closest('.terminal-outer') as HTMLElement | null
    if (outerPanel) outerPanel.style.backgroundColor = bg

    termRef.current = terminal
    fitRef.current = fitAddon

    // Fit after a frame to ensure container has final layout dimensions (grid mode)
    requestAnimationFrame(() => {
      fitAddon.fit()
      const { cols, rows } = terminal
      window.cccAPI.terminal.resize(sessionId, cols, rows)

      // Second fit after layout settles (react-grid-layout may resize async)
      setTimeout(() => {
        fitAddon.fit()
        const { cols, rows } = terminal
        window.cccAPI.terminal.resize(sessionId, cols, rows)
      }, 100)
    })

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
      const bg = getTerminalTheme(theme).background
      termRef.current.options.theme = getTerminalTheme(theme)
      // Sync all backgrounds
      if (containerRef.current) {
        containerRef.current.style.backgroundColor = bg
        const outerPanel = containerRef.current.closest('.terminal-outer') as HTMLElement | null
        if (outerPanel) outerPanel.style.backgroundColor = bg
      }
      if (fitRef.current) {
        fitRef.current.fit()
      }
    }
  }, [theme, containerRef])
}
