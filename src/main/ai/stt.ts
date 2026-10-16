import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TranscribeResult } from '../../shared/api'
import { STT_MODEL } from './tiers'

let cacheDir = ''
let allowRemote = false

export function configureModels(modelsDir: string, allowRemoteModels: boolean): void {
  cacheDir = modelsDir
  allowRemote = allowRemoteModels
}

export const modelsConfig = (): { cacheDir: string; allowRemote: boolean } => ({
  cacheDir,
  allowRemote
})

export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** transformers.js writes <cacheDir>/<repo>/<file>; the q8 decoder is the last file it needs. */
export const sttModelFile = (dir: string): string =>
  join(dir, STT_MODEL, 'onnx/decoder_model_merged_quantized.onnx')
const modelCached = (): boolean => existsSync(sttModelFile(cacheDir))

type Asr = (audio: Float32Array) => Promise<{ text: string } | { text: string }[]>
type Loaded = { run: Asr; dispose(): Promise<void> }

async function load(): Promise<Loaded> {
  // ESM-only package: dynamic import also works from the CJS main bundle.
  const { env, pipeline } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = allowRemote
  const p = await pipeline('automatic-speech-recognition', STT_MODEL, { dtype: 'q8' })
  return { run: p as unknown as Asr, dispose: () => p.dispose() }
}

export function createTranscriber(): {
  transcribe(samples: Float32Array): Promise<TranscribeResult>
  dispose(): Promise<void>
} {
  let loading: Promise<Loaded> | null = null
  return {
    async transcribe(samples) {
      if (!allowRemote && !modelCached()) {
        return { ok: false, reason: 'no-model', message: `Modelo não encontrado em ${cacheDir}` }
      }
      try {
        // Reuse the loaded pipeline; a failed load is retried on the next call.
        const l = await (loading ??= load().catch((e) => {
          loading = null
          throw e
        }))
        const out = await l.run(samples)
        return { ok: true, text: cleanTranscript((Array.isArray(out) ? out[0] : out).text) }
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
    },
    async dispose() {
      const l = await loading?.catch(() => null)
      loading = null
      await l?.dispose()
    }
  }
}
