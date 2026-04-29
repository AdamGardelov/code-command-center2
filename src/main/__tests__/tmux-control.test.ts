import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { TmuxControl } from '../tmux-control'

const TEST_SOCKET = `ccc-ctl-test-${process.pid}`

function tmux(...args: string[]): string {
  return execFileSync('tmux', ['-L', TEST_SOCKET, ...args], {
    encoding: 'utf-8',
    timeout: 3000,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
}

function killServer(): void {
  try {
    execFileSync('tmux', ['-L', TEST_SOCKET, 'kill-server'], {
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
  } catch {
    // ignore
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('TmuxControl (local)', () => {
  let ctl: TmuxControl

  beforeEach(() => {
    killServer()
    tmux('new-session', '-d', '-s', 'seed')
    ctl = new TmuxControl({ socketName: TEST_SOCKET })
  })

  afterEach(async () => {
    await ctl.stop()
    killServer()
  })

  it('emits sessions-changed when a session is created', async () => {
    await ctl.start()
    let count = 0
    ctl.on('sessions-changed', () => {
      count++
    })
    tmux('new-session', '-d', '-s', 'extra')
    await wait(400)
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('emits session-closed when a session is killed', async () => {
    tmux('new-session', '-d', '-s', 'doomed')
    await ctl.start()
    const closed: string[] = []
    ctl.on('session-closed', (name) => {
      closed.push(name)
    })
    tmux('kill-session', '-t', '=doomed')
    await wait(500)
    expect(closed).toContain('doomed')
  })

  it('listSessions returns parsed sessions over the persistent connection', async () => {
    await ctl.start()
    const list = await ctl.listSessions()
    expect(list.some((s) => s.name === 'seed')).toBe(true)
  })

  it('command() returns stdout lines for ad-hoc tmux commands', async () => {
    await ctl.start()
    const lines = await ctl.command('display-message -p "hello-from-cmd"')
    expect(lines).toEqual(['hello-from-cmd'])
  })

  it('hides the internal control session from listSessions', async () => {
    await ctl.start()
    const list = await ctl.listSessions()
    expect(list.some((s) => s.name === '__ccc-ctl')).toBe(false)
  })

  it('survives the death of an unrelated session', async () => {
    tmux('new-session', '-d', '-s', 'transient')
    await ctl.start()
    tmux('kill-session', '-t', '=transient')
    await wait(300)
    // Connection is still usable.
    const lines = await ctl.command('display-message -p "alive"')
    expect(lines).toEqual(['alive'])
  })
})
