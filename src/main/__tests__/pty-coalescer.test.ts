import { describe, it, expect, vi } from 'vitest'
import { PtyCoalescer } from '../pty-coalescer'

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

describe('PtyCoalescer', () => {
  it('combines multiple pushes within the flush window into one send', async () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 16, 64 * 1024)
    c.push('s1', 'hello')
    c.push('s1', ' ')
    c.push('s1', 'world')
    expect(send).not.toHaveBeenCalled()
    await wait(40)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('s1', 'hello world')
  })

  it('flushes immediately when the buffer exceeds the byte threshold', () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 100, 16)
    c.push('s1', 'hello world!') // 12 bytes
    expect(send).not.toHaveBeenCalled()
    c.push('s1', 'more') // total 16, hits threshold
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('s1', 'hello world!more')
  })

  it('keeps buffers per session independent', async () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 16, 64 * 1024)
    c.push('a', 'A')
    c.push('b', 'B')
    c.push('a', 'A2')
    await wait(40)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledWith('a', 'AA2')
    expect(send).toHaveBeenCalledWith('b', 'B')
  })

  it('flushAll empties every pending session', () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 1000, 64 * 1024)
    c.push('a', 'A')
    c.push('b', 'B')
    c.flushAll()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('clear cancels the pending flush for a session', async () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 16, 64 * 1024)
    c.push('s1', 'discard me')
    c.clear('s1')
    await wait(40)
    expect(send).not.toHaveBeenCalled()
  })

  it('a second push after a flush starts a new window', async () => {
    const send = vi.fn<(id: string, data: string) => void>()
    const c = new PtyCoalescer({ send }, 16, 64 * 1024)
    c.push('s1', 'first')
    await wait(40)
    expect(send).toHaveBeenCalledTimes(1)
    c.push('s1', 'second')
    await wait(40)
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith('s1', 'second')
  })
})
