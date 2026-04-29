import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { isGitDirty } from '../git-dirty'
import { OscParser } from '../osc-parser'

function makeRepo(parent: string, name: string): string {
  const repoPath = join(parent, name)
  mkdirSync(repoPath, { recursive: true })
  execFileSync('git', ['init', '-b', 'main', repoPath], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'config', 'user.email', 'test@example.com'], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'config', 'user.name', 'Test'], { stdio: 'pipe' })
  writeFileSync(join(repoPath, 'README.md'), '# initial\n')
  execFileSync('git', ['-C', repoPath, 'add', '.'], { stdio: 'pipe' })
  execFileSync('git', ['-C', repoPath, 'commit', '-m', 'init'], { stdio: 'pipe' })
  return repoPath
}

describe('isGitDirty', () => {
  let scratch: string

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'ccc-dirty-'))
  })

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true })
  })

  it('returns false for a clean repo', () => {
    const repo = makeRepo(scratch, 'clean')
    expect(isGitDirty(repo)).toBe(false)
  })

  it('returns true when there is an untracked file', () => {
    const repo = makeRepo(scratch, 'untracked')
    writeFileSync(join(repo, 'new.txt'), 'untracked\n')
    expect(isGitDirty(repo)).toBe(true)
  })

  it('returns true when a tracked file has unstaged changes', () => {
    const repo = makeRepo(scratch, 'modified')
    writeFileSync(join(repo, 'README.md'), '# changed\n')
    expect(isGitDirty(repo)).toBe(true)
  })

  it('returns false for a non-git path without throwing', () => {
    const notRepo = join(scratch, 'plain')
    mkdirSync(notRepo, { recursive: true })
    expect(isGitDirty(notRepo)).toBe(false)
  })
})

describe('OscParser notification callback', () => {
  it('reports OSC 9 notifications with text and timestamp', () => {
    const calls: Array<{ id: string; text: string }> = []
    const parser = new OscParser(() => {
      // status callback unused here
    })
    parser.setNotificationCallback((id, text) => {
      calls.push({ id, text })
    })
    parser.parse('s1', '\x1b]9;Build finished\x07')
    expect(calls).toEqual([{ id: 's1', text: 'Build finished' }])
  })

  it('does not fire the notification callback for OSC 9;4 progress payloads', () => {
    const calls: Array<{ id: string; text: string }> = []
    const parser = new OscParser(() => {})
    parser.setNotificationCallback((id, text) => {
      calls.push({ id, text })
    })
    parser.parse('s1', '\x1b]9;4;1\x07')
    expect(calls).toEqual([])
  })

  it('emits sequential notifications, not just the first', () => {
    const calls: string[] = []
    const parser = new OscParser(() => {})
    parser.setNotificationCallback((_id, text) => {
      calls.push(text)
    })
    parser.parse('s1', '\x1b]9;first\x07\x1b]9;second\x07')
    expect(calls).toEqual(['first', 'second'])
  })
})
