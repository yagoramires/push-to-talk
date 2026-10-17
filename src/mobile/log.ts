import type { TextFs } from './fs'

const show = (a: unknown): string => {
  if (typeof a === 'string') return a
  if (a instanceof Error) return a.stack ?? a.message
  try {
    return JSON.stringify(a) ?? String(a)
  } catch {
    return String(a)
  }
}

/**
 * Copies console.log/info/warn/error to logs/main.log (previous run kept as main.old.log), like
 * src/main/log.ts. Never log transcripts or audio here. Returns the log path.
 */
export function initMobileLog(fs: TextFs): string {
  const path = 'logs/main.log'
  let queue: Promise<void> = (async () => {
    try {
      const old = await fs.read(path)
      if (old !== undefined) await fs.write('logs/main.old.log', old)
      await fs.write(path, '')
    } catch {
      // Logging must never stop the app.
    }
  })()
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      const line = `${new Date().toISOString()} ${level.toUpperCase()} ${args.map(show).join(' ')}\n`
      queue = queue.then(() => fs.append(path, line)).catch(() => {})
    }
  }
  globalThis.addEventListener?.('error', (e) => console.error('uncaught', e.error ?? e.message))
  globalThis.addEventListener?.('unhandledrejection', (e) =>
    console.error('unhandledRejection', e.reason)
  )
  return path
}
