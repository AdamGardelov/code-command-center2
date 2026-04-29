import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createConnection } from 'net'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { OutputStream } from '../output-stream'

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('OutputStream', () => {
  let dir: string
  let path: string
  let svc: OutputStream

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ccc-out-'))
    path = join(dir, 'output.sock')
    svc = new OutputStream(path)
  })

  afterEach(async () => {
    await svc.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  it('routes pane bytes to a per-session callback after the header line', async () => {
    const chunks: Array<[string, string]> = []
    svc.on('output', (name: string, data: Buffer) => {
      chunks.push([name, data.toString('utf-8')])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('session:foo\n')
    client.write('hello world')
    client.end()
    await wait(100)

    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks.every(([n]) => n === 'foo')).toBe(true)
    expect(chunks.map(([, d]) => d).join('')).toBe('hello world')
  })

  it('handles a header split across multiple data events', async () => {
    const chunks: Array<[string, string]> = []
    svc.on('output', (name: string, data: Buffer) => {
      chunks.push([name, data.toString('utf-8')])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('sessio')
    await wait(20)
    client.write('n:bar\nhello')
    client.end()
    await wait(100)

    expect(chunks.map(([, d]) => d).join('')).toBe('hello')
    expect(chunks[0][0]).toBe('bar')
  })

  it('handles header and data arriving together in one chunk', async () => {
    const chunks: Array<[string, string]> = []
    svc.on('output', (name: string, data: Buffer) => {
      chunks.push([name, data.toString('utf-8')])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('session:baz\nabc123')
    client.end()
    await wait(100)

    expect(chunks.map(([, d]) => d).join('')).toBe('abc123')
    expect(chunks[0][0]).toBe('baz')
  })

  it('isolates concurrent connections from different sessions', async () => {
    const chunks: Array<[string, string]> = []
    svc.on('output', (name: string, data: Buffer) => {
      chunks.push([name, data.toString('utf-8')])
    })
    await svc.start()

    const a = createConnection(path)
    const b = createConnection(path)
    await Promise.all([
      new Promise((r) => a.on('connect', r as () => void)),
      new Promise((r) => b.on('connect', r as () => void))
    ])
    a.write('session:alpha\nA')
    b.write('session:beta\nB')
    a.end()
    b.end()
    await wait(150)

    const alphaData = chunks.filter(([n]) => n === 'alpha').map(([, d]) => d).join('')
    const betaData = chunks.filter(([n]) => n === 'beta').map(([, d]) => d).join('')
    expect(alphaData).toBe('A')
    expect(betaData).toBe('B')
  })

  it('drops connections that never send a header line', async () => {
    const chunks: Array<[string, string]> = []
    svc.on('output', (name: string, data: Buffer) => {
      chunks.push([name, data.toString('utf-8')])
    })
    await svc.start()

    const client = createConnection(path)
    await new Promise((r) => client.on('connect', r as () => void))
    client.write('no-newline-just-bytes')
    client.end()
    await wait(100)

    expect(chunks).toEqual([])
  })

  it('cleans up the socket file on stop()', async () => {
    await svc.start()
    expect(existsSync(path)).toBe(true)
    await svc.stop()
    expect(existsSync(path)).toBe(false)
  })
})
