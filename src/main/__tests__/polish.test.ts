import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { SessionManager } from '../session-manager'
import { TmuxControl } from '../tmux-control'

const SOCKET = `ccc-polish-test-${process.pid}`

function tmux(...args: string[]): string {
  return execFileSync('tmux', ['-L', SOCKET, ...args], {
    encoding: 'utf-8',
    timeout: 3000,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
}

function killServer(): void {
  try {
    execFileSync('tmux', ['-L', SOCKET, 'kill-server'], {
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    // ignore
  }
}

describe('SessionManager polish (tier 2 tmux options)', () => {
  beforeAll(() => {
    process.env.CCC_TEST_TMUX_SOCKET = SOCKET
  })

  afterAll(() => {
    delete process.env.CCC_TEST_TMUX_SOCKET
  })

  beforeEach(() => {
    killServer()
  })

  afterEach(() => {
    killServer()
  })

  it('sets escape-time to 0 server-wide on first create', async () => {
    const mgr = new SessionManager()
    await mgr.create({
      name: 'esc-time',
      workingDirectory: process.env.HOME ?? '/tmp',
      type: 'shell'
    })
    const escapeTime = tmux('show-options', '-g', '-v', 'escape-time')
    expect(escapeTime).toBe('0')
  })

  it('bumps history-limit so capture-pane previews have real scrollback', async () => {
    const mgr = new SessionManager()
    await mgr.create({
      name: 'history',
      workingDirectory: process.env.HOME ?? '/tmp',
      type: 'shell'
    })
    const limit = parseInt(tmux('show-options', '-t', 'ccc-history', '-v', 'history-limit'), 10)
    expect(limit).toBeGreaterThanOrEqual(50000)
  })

  it('shows the pane border with state and session name', async () => {
    const mgr = new SessionManager()
    await mgr.create({
      name: 'border',
      workingDirectory: process.env.HOME ?? '/tmp',
      type: 'shell'
    })
    const status = tmux('show-options', '-t', 'ccc-border', '-w', '-v', 'pane-border-status')
    expect(status).toBe('top')
    const fmt = tmux('show-options', '-t', 'ccc-border', '-w', '-v', 'pane-border-format')
    expect(fmt).toContain('@ccc-state')
    expect(fmt).toContain('session_name')
  })

  it('updateStatus writes @ccc-state and the pane border picks it up automatically', async () => {
    const mgr = new SessionManager()
    await mgr.create({
      name: 'live',
      workingDirectory: process.env.HOME ?? '/tmp',
      type: 'shell'
    })
    mgr.updateStatus('live', 'working')
    const stored = tmux('show-options', '-t', 'ccc-live', '-v', '@ccc-state')
    expect(stored).toBe('working')
    // pane-border-format references @ccc-state, so display-message expansion
    // of the format must also flip to "working".
    const rendered = tmux(
      'display-message',
      '-t',
      'ccc-live',
      '-p',
      '#{@ccc-state}'
    )
    expect(rendered).toBe('working')
  })
})

describe('TmuxControl uses new-session -A for the control session', () => {
  beforeEach(() => {
    killServer()
  })

  afterEach(async () => {
    killServer()
  })

  it('starting a second TmuxControl on the same socket does not fail', async () => {
    const a = new TmuxControl({ socketName: SOCKET })
    const b = new TmuxControl({ socketName: SOCKET })
    await a.start()
    // Pre-existing __ccc-ctl from `a` should be reused by `b` via -A.
    await b.start()
    expect(a.isRunning()).toBe(true)
    expect(b.isRunning()).toBe(true)
    await a.stop()
    await b.stop()
  })
})
