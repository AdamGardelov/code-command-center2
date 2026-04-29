import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection } from 'net'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { EventSocket } from '../event-socket'
import { StateDetector } from '../state-detector'

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('EventSocket', () => {
  let dir: string
  let path: string
  let svc: EventSocket

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ccc-evt-'))
    path = join(dir, 'events.sock')
    svc = new EventSocket(path)
  })

  afterEach(async () => {
    await svc.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('parses newline-delimited "kind:session" payloads', async () => {
    const events: Array<[string, string]> = []
    svc.on('event', (kind: string, sessionName: string) => {
      events.push([kind, sessionName])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('alert-silence:my-session\n')
    client.write('alert-activity:my-session\n')
    client.end()
    await wait(150)

    expect(events).toEqual([
      ['alert-silence', 'my-session'],
      ['alert-activity', 'my-session']
    ])
  })

  it('handles partial chunks split across writes', async () => {
    const events: Array<[string, string]> = []
    svc.on('event', (kind: string, sessionName: string) => {
      events.push([kind, sessionName])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('alert-')
    await wait(20)
    client.write('silence:foo\n')
    client.end()
    await wait(150)

    expect(events).toEqual([['alert-silence', 'foo']])
  })

  it('cleans up the socket file on stop()', async () => {
    await svc.start()
    expect(existsSync(path)).toBe(true)
    await svc.stop()
    expect(existsSync(path)).toBe(false)
  })

  it('removes a stale socket file on start()', async () => {
    const fs = await import('fs')
    fs.writeFileSync(path, 'stale')
    await svc.start()
    // The file is now a socket, not the stale regular file.
    const stat = fs.statSync(path)
    expect(stat.isSocket()).toBe(true)
  })
})

describe('StateDetector hook event mapping', () => {
  it('sets working on alert-activity and idle on alert-silence', () => {
    const det = new StateDetector()
    det.handleHookEvent('alert-activity', 'foo')
    expect(det.getState('foo')).toBe('working')
    det.handleHookEvent('alert-silence', 'foo')
    expect(det.getState('foo')).toBe('idle')
  })

  it('marks error on pane-died', () => {
    const det = new StateDetector()
    det.handleHookEvent('pane-died', 'foo')
    expect(det.getState('foo')).toBe('error')
  })

  it('ignores unknown event kinds', () => {
    const det = new StateDetector()
    det.handleHookEvent('mystery-event', 'foo')
    expect(det.getState('foo')).toBe('idle')
  })
})
