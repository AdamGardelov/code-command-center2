import { appendFileSync, readFileSync, existsSync, statSync, renameSync } from 'fs'
import { join } from 'path'

const LOG_DIR = join(process.env.HOME ?? '', '.ccc')
const LOG_PATH = join(LOG_DIR, 'app.log')
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

function rotateIfNeeded(): void {
  try {
    if (existsSync(LOG_PATH) && statSync(LOG_PATH).size > MAX_SIZE) {
      renameSync(LOG_PATH, LOG_PATH + '.old')
    }
  } catch { /* ignore */ }
}

function timestamp(): string {
  return new Date().toISOString()
}

function write(level: string, message: string): void {
  rotateIfNeeded()
  const line = `[${timestamp()}] [${level}] ${message}\n`
  try {
    appendFileSync(LOG_PATH, line)
  } catch { /* ignore */ }
}

export const log = {
  info: (msg: string) => write('INFO', msg),
  warn: (msg: string) => write('WARN', msg),
  error: (msg: string) => write('ERROR', msg),
}

export function readLogs(lines = 200): string {
  try {
    if (!existsSync(LOG_PATH)) return ''
    const content = readFileSync(LOG_PATH, 'utf-8')
    const allLines = content.split('\n')
    return allLines.slice(-lines).join('\n')
  } catch {
    return ''
  }
}

export function getLogPath(): string {
  return LOG_PATH
}
