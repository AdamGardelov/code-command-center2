import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { SessionManager } from '../session-manager'
import type { Session } from '../../shared/types'

const SOCKET = `ccc-cap-test-${process.pid}`

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

function injectSession(mgr: SessionManager, id: string, name: string): void {
  const session: Session = {
    id,
    name,
    workingDirectory: '~',
    status: 'idle',
    type: 'shell',
    color: '#fff',
    createdAt: 0,
    lastActiveAt: 0
  }
  ;(mgr as unknown as { sessions: Map<string, Session> }).sessions.set(id, session)
}

describe('SessionManager.capturePane', () => {
  let mgr: SessionManager

  beforeAll(() => {
    process.env.CCC_TEST_TMUX_SOCKET = SOCKET
  })

  afterAll(() => {
    delete process.env.CCC_TEST_TMUX_SOCKET
  })

  beforeEach(() => {
    killServer()
    tmux('new-session', '-d', '-s', 'ccc-cap')
    tmux('send-keys', '-t', 'ccc-cap', 'echo hello-from-pane', 'Enter')
    // Give the shell a moment to render the output.
    execFileSync('sleep', ['0.2'])
    mgr = new SessionManager()
  })

  afterEach(() => {
    killServer()
  })

  it('captures recent lines from a session', async () => {
    injectSession(mgr, 'fake-id', 'cap')
    const text = await mgr.capturePane('fake-id', 50)
    expect(text).toContain('hello-from-pane')
  })

  it('returns empty string when the session id is unknown', async () => {
    const text = await mgr.capturePane('does-not-exist', 50)
    expect(text).toBe('')
  })
})

describe('SessionManager @ccc-* user options', () => {
  let mgr: SessionManager

  beforeAll(() => {
    process.env.CCC_TEST_TMUX_SOCKET = SOCKET
  })

  afterAll(() => {
    delete process.env.CCC_TEST_TMUX_SOCKET
  })

  beforeEach(() => {
    killServer()
    tmux('new-session', '-d', '-s', 'ccc-meta')
    mgr = new SessionManager()
  })

  afterEach(() => {
    killServer()
  })

  it('writes the @ccc-state user option when status changes', () => {
    injectSession(mgr, 'meta-id', 'meta')
    mgr.updateStatus('meta', 'working')
    const stored = tmux('show-options', '-t', 'ccc-meta', '-v', '@ccc-state')
    expect(stored).toBe('working')
  })
})
