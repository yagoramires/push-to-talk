import { createHash } from 'node:crypto'

/** File name of a text's bundled audio (scripts/generate-audio.mjs imports this too). */
export function audioFile(text: string): string {
  return createHash('sha1').update(text.trim()).digest('hex').slice(0, 16) + '.mp3'
}
