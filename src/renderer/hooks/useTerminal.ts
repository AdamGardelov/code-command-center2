import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../stores/session-store'

function getTerminalTheme(theme: 'dark' | 'light'): Record<string, string> {
  if (theme === 'light') {
    return {
      background: '#fafafa',
      foreground: '#1a1a1a',
      cursor: '#b45f04',
      selectionBackground: 'rgba(180, 95, 4, 0.2)',
      black: '#1a1a1a',
      red: '#b91c1c',
      green: '#047857',
      yellow: '#92600a',
      blue: '#1d4ed8',
      magenta: '#7e22ce',
      cyan: '#0e7490',
      white: '#737373',
      brightBlack: '#737373',
      brightRed: '#dc2626',
      brightGreen: '#059669',
      brightYellow: '#b45f04',
      brightBlue: '#2563eb',
      brightMagenta: '#9333ea',
      brightCyan: '#0891b2',
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

  const handleImagePaste = async (file: File): Promise<void> => {
    try {
      const session = useSessionStore.getState().sessions.find((s) => s.id === sessionId)
      if (session?.remoteHost) return
      const bytes = new Uint8Array(await file.arrayBuffer())
      const ext = file.type === 'image/jpeg' ? 'jpg' : 'png'
      const filepath = await window.cccAPI.clipboard.writeImage(bytes, ext)
      console.log('[image paste] wrote', filepath)
      termRef.current?.paste(filepath + ' ')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to paste image'
      console.error('[image paste]', message)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || !sessionId) return

    const terminal = new Terminal({
      fontFamily: 'monospace',
      fontSize: 12,
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

    terminal.loadAddon(new WebLinksAddon((_event, uri) => {
      window.cccAPI.shell.openExternal(uri)
    }))

    // Set all parent backgrounds to match xterm exactly (avoids fractional pixel gaps)
    const bg = getTerminalTheme(theme).background
    container.style.backgroundColor = bg
    const outerPanel = container.closest('.terminal-outer') as HTMLElement | null
    if (outerPanel) outerPanel.style.backgroundColor = bg

    termRef.current = terminal
    fitRef.current = fitAddon

    // Swallow Ctrl/Cmd+V so the raw keystroke doesn't reach the pty — the
    // browser will still fire a 'paste' event which we handle below.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      const isPaste =
        event.key.toLowerCase() === 'v' &&
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey
      return !isPaste
    })

    // Intercept paste entirely — handle images ourselves, forward text to xterm.
    // We always preventDefault + stopImmediatePropagation so xterm's own paste
    // listener doesn't also fire (which would duplicate text).
    const onPaste = (event: ClipboardEvent): void => {
      const data = event.clipboardData
      if (!data) return
      event.preventDefault()
      event.stopImmediatePropagation()

      const file =
        Array.from(data.files).find((f) => f.type.startsWith('image/')) ??
        Array.from(data.items).find((i) => i.type.startsWith('image/'))?.getAsFile() ??
        null

      if (file) {
        void handleImagePaste(file)
        return
      }

      const text = data.getData('text/plain')
      if (text) termRef.current?.paste(text)
    }
    container.addEventListener('paste', onPaste, true)

    // Helper: fit terminal and sync pty size (skips if container has no area)
    const fitAndResize = (): void => {
      if (!container.offsetWidth || !container.offsetHeight) return
      fitAddon.fit()
      const { cols, rows } = terminal
      window.cccAPI.terminal.resize(sessionId, cols, rows)
    }

    // Fit first, then attach — so tmux gets correct dimensions from the start
    requestAnimationFrame(() => {
      fitAndResize()

      // Attach AFTER fit so tmux session uses our dimensions
      window.cccAPI.session.attach(sessionId, terminal.cols, terminal.rows)

      // Re-fit after layout fully settles (grid mode, sidebar animations, etc.)
      setTimeout(fitAndResize, 100)
      setTimeout(fitAndResize, 300)
      setTimeout(fitAndResize, 800)
    })

    const selectionDisposable = terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      if (selection) {
        window.cccAPI.clipboard.writeText(selection)
      }
    })

    const inputDisposable = terminal.onData((data) => {
      window.cccAPI.terminal.write(sessionId, data)
    })

    const unsubData = window.cccAPI.terminal.onData(sessionId, (data) => {
      terminal.write(data)
    })
    unsubDataRef.current = unsubData

    let resizeRaf = 0
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(fitAndResize)
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(resizeRaf)
      resizeObserver.disconnect()
      container.removeEventListener('paste', onPaste, true)
      selectionDisposable.dispose()
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
