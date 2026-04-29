import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'child_process'
import { SessionManager } from '../session-manager'

const SOCKET = `ccc-restore-test-${process.pid}`

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

describe('SessionManager.list state restore', () => {
  let mgr: SessionManager

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

  it('restores session.status from @ccc-state when CCC has no in-memory record', async () => {
    tmux('new-session', '-d', '-s', 'ccc-restore-me')
    tmux('set-option', '-t', 'ccc-restore-me', '@ccc-state', 'working')
    tmux('set-option', '-t', 'ccc-restore-me', '@ccc-type', 'codex')
    mgr = new SessionManager()
    const sessions = await mgr.list()
    const restored = sessions.find((s) => s.name === 'restore-me')
    expect(restored).toBeDefined()
    expect(restored?.status).toBe('working')
    expect(restored?.type).toBe('codex')
  })

  it('falls back to idle when @ccc-state is unset', async () => {
    tmux('new-session', '-d', '-s', 'ccc-no-state')
    mgr = new SessionManager()
    const sessions = await mgr.list()
    const found = sessions.find((s) => s.name === 'no-state')
    expect(found?.status).toBe('idle')
  })

  it('ignores invalid @ccc-state values', async () => {
    tmux('new-session', '-d', '-s', 'ccc-bogus')
    tmux('set-option', '-t', 'ccc-bogus', '@ccc-state', 'banana')
    mgr = new SessionManager()
    const sessions = await mgr.list()
    const found = sessions.find((s) => s.name === 'bogus')
    expect(found?.status).toBe('idle')
  })
})

describe('SessionManager session defaults', () => {
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

  it('creates a session with automatic-rename off and detach-on-destroy off', async () => {
    const mgr = new SessionManager()
    await mgr.create({
      name: 'defaults-check',
      workingDirectory: process.env.HOME ?? '/tmp',
      type: 'shell'
    })
    const autoRename = tmux('show-options', '-t', 'ccc-defaults-check', '-w', '-v', 'automatic-rename')
    const detachOnDestroy = tmux('show-options', '-t', 'ccc-defaults-check', '-v', 'detach-on-destroy')
    expect(autoRename).toBe('off')
    expect(detachOnDestroy).toBe('off')
  })
})
