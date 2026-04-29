import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { TMUX_SOCKET_NAME, tmuxArgs, tmuxArgsForRemote } from '../tmux-socket'

describe('tmux-socket', () => {
  it('exposes the CCC socket name', () => {
    expect(TMUX_SOCKET_NAME).toBe('ccc')
  })

  it('prepends -L <socket> to local tmux args', () => {
    expect(tmuxArgs('list-sessions', '-F', '#{session_name}')).toEqual([
      '-L',
      'ccc',
      'list-sessions',
      '-F',
      '#{session_name}'
    ])
  })

  it('builds a remote tmux invocation string with -L', () => {
    expect(tmuxArgsForRemote('has-session', '-t', '=ccc-x')).toBe(
      "tmux -L ccc 'has-session' '-t' '=ccc-x'"
    )
  })

  it('shell-escapes single quotes in remote args', () => {
    expect(tmuxArgsForRemote('display-message', "it's fine")).toBe(
      "tmux -L ccc 'display-message' 'it'\\''s fine'"
    )
  })

  it('honors the CCC_TEST_TMUX_SOCKET override', () => {
    const original = process.env.CCC_TEST_TMUX_SOCKET
    process.env.CCC_TEST_TMUX_SOCKET = 'ccc-test-override'
    try {
      expect(tmuxArgs('list-sessions')).toEqual(['-L', 'ccc-test-override', 'list-sessions'])
    } finally {
      if (original === undefined) delete process.env.CCC_TEST_TMUX_SOCKET
      else process.env.CCC_TEST_TMUX_SOCKET = original
    }
  })
})

describe('tmux socket isolation (live)', () => {
  it('a session on the ccc-test socket does not appear on the default socket', () => {
    const sock = `ccc-iso-test-${process.pid}`
    const sessionName = `iso-${Date.now()}`
    try {
      execFileSync('tmux', ['-L', sock, 'new-session', '-d', '-s', sessionName], {
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      const onCcc = execFileSync(
        'tmux',
        ['-L', sock, 'list-sessions', '-F', '#{session_name}'],
        { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim()
      expect(onCcc.split('\n')).toContain(sessionName)

      let onDefault = ''
      try {
        onDefault = execFileSync('tmux', ['list-sessions', '-F', '#{session_name}'], {
          encoding: 'utf-8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim()
      } catch {
        onDefault = ''
      }
      expect(onDefault.split('\n')).not.toContain(sessionName)
    } finally {
      try {
        execFileSync('tmux', ['-L', sock, 'kill-server'], {
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch {
        // ignore
      }
    }
  })
})
