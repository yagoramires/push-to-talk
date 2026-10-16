import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import type { TranscribeResult } from '../../shared/api'

export type Runner = (
  bin: string,
  args: string[]
) => Promise<{ code: number; stdout: string; stderr: string }>

/** Rejects with `code: 'ENOENT'` when the binary is missing; any other exit resolves. */
const defaultRun: Runner = (bin, args) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return reject(err)
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0
      resolve({ code, stdout, stderr })
    })
  })

export function cleanWhisperOutput(stdout: string): string {
  return stdout
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function createWhisperTranscriber(o: {
  bin: string
  model: string
  run?: Runner
  exists?: (path: string) => boolean
}): { transcribe(wavPath: string): Promise<TranscribeResult> } {
  const run = o.run ?? defaultRun
  const exists = o.exists ?? existsSync
  return {
    async transcribe(wavPath) {
      if (!exists(o.model)) {
        return { ok: false, reason: 'no-model', message: `Modelo não encontrado: ${o.model}` }
      }
      try {
        const r = await run(o.bin, ['-m', o.model, '-f', wavPath, '-l', 'en', '-nt', '-np'])
        if (r.code !== 0) {
          return {
            ok: false,
            reason: 'failed',
            message: `whisper saiu com código ${r.code}: ${r.stderr.trim()}`
          }
        }
        return { ok: true, text: cleanWhisperOutput(r.stdout) }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
          return { ok: false, reason: 'no-binary', message: `Binário não encontrado: ${o.bin}` }
        }
        return { ok: false, reason: 'failed', message: String(e) }
      }
    }
  }
}
