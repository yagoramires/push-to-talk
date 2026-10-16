import { app, net, protocol } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** course-audio://audio/<16 hex>.mp3 → contentDir/audio/<file>; anything else (e.g. "..") → null. */
export function audioPathFor(contentDir: string, url: string): string | null {
  const { host, pathname } = new URL(url)
  // Matched before any decoding, so %2F or ".." can never reach the file system.
  return host === 'audio' && /^\/[0-9a-f]{16}\.mp3$/.test(pathname)
    ? join(contentDir, 'audio', pathname.slice(1))
    : null
}

/** Call before app ready: the scheme must be privileged for <audio> to stream from it. */
export function registerAudioProtocol(contentDir: string): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'course-audio', privileges: { standard: true, secure: true, stream: true } }
  ])
  void app.whenReady().then(() =>
    protocol.handle('course-audio', (req) => {
      const path = audioPathFor(contentDir, req.url)
      return path ? net.fetch(pathToFileURL(path).toString()) : new Response(null, { status: 404 })
    })
  )
}
