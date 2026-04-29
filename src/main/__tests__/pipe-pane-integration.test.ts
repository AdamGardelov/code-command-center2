import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { OutputStream } from '../output-stream'

const SOCKET_NAME = `ccc-pp-${process.pid}`

function tmux(...args: string[]): string {
  return execFileSync('tmux', ['-L', SOCKET_NAME, ...args], {
    encoding: 'utf-8',
    timeout: 3000,
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
}

function killServer(): void {
  try {
    execFileSync('tmux', ['-L', SOCKET_NAME, 'kill-server'], {
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

describe('pipe-pane → OutputStream end-to-end', () => {
  let dir: string
  let sockPath: string
  let svc: OutputStream

  beforeEach(async () => {
    killServer()
    dir = mkdtempSync(join(tmpdir(), 'ccc-pp-'))
    sockPath = join(dir, 'output.sock')
    svc = new OutputStream(sockPath)
    await svc.start()
  })

  afterEach(async () => {
    await svc.stop()
    killServer()
    rmSync(dir, { recursive: true, force: true })
  })

  it('delivers send-keys output to the OutputStream listener', async () => {
    const received: string[] = []
    svc.on('output', (name: string, data: Buffer) => {
      if (name === 'ccc-target') received.push(data.toString('utf-8'))
    })

    tmux('new-session', '-d', '-s', 'ccc-target')
    tmux(
      'pipe-pane',
      '-O',
      '-t',
      '=ccc-target:',
      `{ printf 'session:#{session_name}\\n'; cat; } | nc -U '${sockPath}' 2>/dev/null`
    )
    // pipe-pane setup is async — give the subshell a moment to connect.
    await wait(150)
    tmux('send-keys', '-t', 'ccc-target', 'echo HELLO_PIPED', 'Enter')
    await wait(400)

    const all = received.join('')
    expect(all).toContain('HELLO_PIPED')
  })
})
