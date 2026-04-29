import { describe, it, expect } from 'vitest'
import { StateDetector } from '../state-detector'

describe('StateDetector agent state via unix socket', () => {
  it('maps agent-working to working', () => {
    const det = new StateDetector()
    det.handleHookEvent('agent-working', 'foo')
    expect(det.getState('foo')).toBe('working')
  })

  it('maps agent-idle to idle', () => {
    const det = new StateDetector()
    det.handleHookEvent('agent-idle', 'foo')
    expect(det.getState('foo')).toBe('idle')
  })

  it('maps agent-waiting to waiting', () => {
    const det = new StateDetector()
    det.handleHookEvent('agent-waiting', 'foo')
    expect(det.getState('foo')).toBe('waiting')
  })

  it('overrides earlier states on subsequent events', () => {
    const det = new StateDetector()
    det.handleHookEvent('agent-working', 'foo')
    det.handleHookEvent('agent-waiting', 'foo')
    expect(det.getState('foo')).toBe('waiting')
    det.handleHookEvent('agent-idle', 'foo')
    expect(det.getState('foo')).toBe('idle')
  })
})
