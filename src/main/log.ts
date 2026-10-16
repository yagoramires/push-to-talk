import { appendFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { format } from 'node:util'
import { join } from 'node:path'

/**
 * Copies every console.log/info/warn/error of the main process to <dir>/main.log, so a tester can send
 * the file back. The previous run is kept as main.old.log. Never log transcripts or audio here.
 */
export function initLog(dir: string): string {
  const path = join(dir, 'main.log')
  try {
    mkdirSync(dir, { recursive: true })
    if (existsSync(path)) renameSync(path, join(dir, 'main.old.log'))
  } catch {
    // Logging must never stop the app.
  }
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      try {
        appendFileSync(
          path,
          `${new Date().toISOString()} ${level.toUpperCase()} ${format(...args)}\n`
        )
      } catch {
        // disk full / no permission: keep running
      }
    }
  }
  process.on('uncaughtException', (e) => console.error('uncaughtException', e))
  process.on('unhandledRejection', (e) => console.error('unhandledRejection', e))
  return path
}
