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
export const sttModelFile = (dir: string, repo = STT_MODEL): string =>
  join(dir, repo, 'onnx/decoder_model_merged_quantized.onnx')

type Tokens = { tolist(): (number | bigint)[] }
type Pipe = {
  (audio: Float32Array): Promise<{ text: string } | { text: string }[]>
  processor(audio: Float32Array): Promise<{ input_features: unknown }>
  model: { generate(o: { inputs: unknown; decoder_input_ids: number[] }): Promise<Tokens[]> }
  tokenizer: {
    encode(text: string, o: { add_special_tokens: boolean }): number[]
    decode(ids: number[], o: { skip_special_tokens: boolean }): string
    convert_tokens_to_ids(tokens: string[]): number[]
  }
  dispose(): Promise<void>
}
type Loaded = {
  run(audio: Float32Array, prompt?: string): Promise<string>
  dispose(): Promise<void>
}

async function load(repo: string): Promise<Loaded> {
  // ESM-only package: dynamic import also works from the CJS main bundle.
  const { env, pipeline } = await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = allowRemote
  const p = (await pipeline('automatic-speech-recognition', repo, {
    dtype: 'q8'
  })) as unknown as Pipe
  const [prev, sot, noTs] = p.tokenizer.convert_tokens_to_ids([
    '<|startofprev|>',
    '<|startoftranscript|>',
    '<|notimestamps|>'
  ])
  return {
    async run(audio, prompt) {
      if (!prompt) {
        const out = await p(audio)
        return (Array.isArray(out) ? out[0] : out).text
      }
      // transformers.js has no prompt_ids for Whisper: build the same decoder prefix by hand
      // (<|startofprev|> prompt <|startoftranscript|> <|notimestamps|>); Whisper caps the prompt at 224 tokens.
      const text = p.tokenizer.encode(` ${prompt}`, { add_special_tokens: false }).slice(-200)
      const prefix = [prev, ...text, sot, noTs]
      const { input_features } = await p.processor(audio)
      const [ids] = await p.model.generate({ inputs: input_features, decoder_input_ids: prefix })
      return p.tokenizer.decode(ids.tolist().slice(prefix.length).map(Number), {
        skip_special_tokens: true
      })
    },
    dispose: () => p.dispose()
  }
}

export function createTranscriber(): {
  /** model falls back to base when absent; expected (the sentence the learner should say) biases decoding toward its words. */
  transcribe(
    samples: Float32Array,
    o?: { model?: string; expected?: string }
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
        return { ok: true, text: cleanTranscript(await l.run(samples, o.expected?.trim())) }
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
