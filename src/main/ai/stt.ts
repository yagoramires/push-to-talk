import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TranscribeResult } from '../../shared/api'
import { cleanTranscript, loadWhisper, type Loaded } from '../../shared/ai/whisper'
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

/** transformers.js writes <cacheDir>/<repo>/<file>; the q8 decoder is the last file it needs. */
export const sttModelFile = (dir: string, repo = STT_MODEL): string =>
  join(dir, repo, 'onnx/decoder_model_merged_quantized.onnx')

async function load(repo: string): Promise<Loaded> {
  // ESM-only package: dynamic import also works from the CJS main bundle.
  const { env } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = allowRemote
  return loadWhisper(repo)
}

export function createTranscriber(): {
  /** model falls back to base when absent; prompt (the sentence the learner should say) biases decoding toward its words. */
  transcribe(
    samples: Float32Array,
    o?: { model?: string; prompt?: string }
  ): Promise<TranscribeResult>
  dispose(): Promise<void>
} {
  let loaded: { repo: string; p: Promise<Loaded> } | null = null
  return {
    async transcribe(samples, o = {}) {
      const repo =
        o.model && (allowRemote || existsSync(sttModelFile(cacheDir, o.model)))
          ? o.model
          : STT_MODEL
      if (!allowRemote && !existsSync(sttModelFile(cacheDir, repo))) {
        return { ok: false, reason: 'no-model', message: `Modelo não encontrado em ${cacheDir}` }
      }
      try {
        if (loaded?.repo !== repo) {
          const old = loaded?.p
          // Reuse the loaded pipeline; a failed load is retried on the next call.
          const p = (async () => {
            await old?.then((l) => l.dispose()).catch(() => {})
            return load(repo)
          })().catch((e) => {
            if (loaded?.p === p) loaded = null
            throw e
          })
          loaded = { repo, p }
        }
        const l = await loaded.p
        return { ok: true, text: cleanTranscript(await l.run(samples, o.prompt?.trim())) }
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
    },
    async dispose() {
      const l = await loaded?.p.catch(() => null)
      loaded = null
      await l?.dispose()
    }
  }
}
