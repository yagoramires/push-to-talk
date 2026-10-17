/// <reference lib="webworker" />
// Whisper and wav2vec2 off the UI thread. Models live in the Cache API; the ORT wasm ships in the APK.
import { AutoModelForCTC, Wav2Vec2FeatureExtractor, env } from '@huggingface/transformers'
import type { PronunciationResult } from '../shared/api'
import { cleanTranscript, loadWhisper, type Loaded } from '../shared/ai/whisper'
import { ctcGreedyDecode, scoreWords, tokenizeIpa } from '../shared/ai/phonemes'
import { normalize } from '../shared/matcher'
import { PRON_MODEL, STT_BASE } from '../shared/models'
import type { AiRequest } from './ai-client'

env.allowLocalModels = false
env.useBrowserCache = true
// Absolute: ORT imports its .mjs relative to its own chunk in assets/, not to the page.
env.backends.onnx.wasm!.wasmPaths = new URL('/ort/', self.location.href).href

const HF = (repo: string, file: string): string =>
  `https://huggingface.co/${repo}/resolve/main/${file}`
// The last file each download writes: its presence means the model is complete.
const MARKER: Record<string, string> = {
  [STT_BASE]: HF(STT_BASE, 'onnx/decoder_model_merged_quantized.onnx'),
  [PRON_MODEL]: HF(PRON_MODEL, 'vocab.json')
}
const SAMPLE_RATE = 16000
const MIN_SECONDS = 0.5

const cache = (): Promise<Cache> => caches.open(env.cacheKey)

/** transformers.js never fetches vocab.json (no tokenizer.json in this repo), so we cache it ourselves. */
async function vocab(download: boolean): Promise<Record<string, number>> {
  const c = await cache()
  let res = await c.match(MARKER[PRON_MODEL])
  if (!res && download) {
    const r = await fetch(MARKER[PRON_MODEL])
    if (!r.ok) throw new Error(`vocab.json: HTTP ${r.status}`)
    await c.put(MARKER[PRON_MODEL], r)
    res = await c.match(MARKER[PRON_MODEL])
  }
  if (!res) throw new Error('vocab.json não está no cache')
  return res.json()
}

let whisper: Promise<Loaded> | null = null
const stt = (): Promise<Loaded> =>
  (whisper ??= loadWhisper(STT_BASE).catch((e) => {
    whisper = null // retried on the next call
    throw e
  }))

type Pron = {
  heard(samples: Float32Array): Promise<string[]>
  vocab: Set<string>
}
let pron: Promise<Pron> | null = null
async function loadPron(): Promise<Pron> {
  const model = await AutoModelForCTC.from_pretrained(PRON_MODEL, { dtype: 'q8' })
  const extractor = await Wav2Vec2FeatureExtractor.from_pretrained(PRON_MODEL)
  const tokenToId = await vocab(false)
  const idToToken: string[] = []
  for (const [t, id] of Object.entries(tokenToId)) idToToken[id] = t
  const blankId = tokenToId['<pad>'] ?? 0
  return {
    async heard(samples) {
      const { logits } = await model(await extractor(samples))
      const [, frames, vocabSize] = logits.dims as number[]
      return ctcGreedyDecode(
        logits.data as Float32Array,
        frames,
        vocabSize,
        idToToken,
        blankId
      ).filter((t) => !/^<.*>$/.test(t))
    },
    vocab: new Set(idToToken.filter((t) => t && !/^<.*>$/.test(t)))
  }
}

async function score(
  samples: Float32Array,
  expectedText: string
): Promise<PronunciationResult | null> {
  if (samples.length < MIN_SECONDS * SAMPLE_RATE) return null
  const l = await (pron ??= loadPron().catch((e) => {
    pron = null
    throw e
  }))
  const heard = await l.heard(samples)
  if (heard.length === 0) return null
  const { phonemize } = await import('phonemizer')
  const expected: { word: string; phones: string[] }[] = []
  // Sequential: one espeak WASM instance underneath.
  for (const word of normalize(expectedText).split(' ').filter(Boolean)) {
    expected.push({
      word,
      phones: tokenizeIpa((await phonemize(word, 'en-us')).join(' '), l.vocab)
    })
  }
  return expected.some((w) => w.phones.length) ? scoreWords(expected, heard) : null
}

type TotalProgress = { status: string; progress?: number }

async function download(repo: string, onPct: (p: number) => void): Promise<void> {
  let pct = 0
  const progress_callback = (i: TotalProgress): void => {
    if (i.status === 'progress_total' && i.progress !== undefined)
      onPct((pct = Math.max(pct, i.progress)))
  }
  if (repo === PRON_MODEL) {
    const model = await AutoModelForCTC.from_pretrained(repo, { dtype: 'q8', progress_callback })
    await model.dispose()
    await Wav2Vec2FeatureExtractor.from_pretrained(repo, { progress_callback })
    await vocab(true) // last: marks the model complete
  } else {
    const { pipeline } = await import('@huggingface/transformers')
    const p = await pipeline('automatic-speech-recognition', repo, {
      dtype: 'q8',
      progress_callback
    })
    await p.dispose()
  }
  onPct(100)
}

async function handle(m: AiRequest, progress: (p: number) => void): Promise<unknown> {
  switch (m.type) {
    case 'has':
      return !!(await (await cache()).match(MARKER[m.repo]))
    case 'download':
      return download(m.repo, progress)
    case 'transcribe':
      return cleanTranscript(await (await stt()).run(m.samples, m.prompt))
    case 'score':
      return score(m.samples, m.expected)
    case 'benchmark': {
      // Same as the desktop: one warm-up run (loads the model), then the measured one.
      const l = await stt()
      await l.run(m.samples)
      const t0 = performance.now()
      await l.run(m.samples)
      return (performance.now() - t0) / 1000 / (m.samples.length / m.sampleRate)
    }
    case 'dispose': {
      const w = await whisper?.catch(() => null)
      whisper = pron = null
      await w?.dispose()
      return
    }
  }
}

const scope = self as unknown as DedicatedWorkerGlobalScope
scope.onmessage = async (e: MessageEvent<AiRequest & { id: number }>) => {
  const { id } = e.data
  try {
    const value = await handle(e.data, (progress) => scope.postMessage({ id, progress }))
    scope.postMessage({ id, value })
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
