import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PronunciationResult } from '../../shared/api'
import { normalize } from '../../shared/matcher'
import { ctcGreedyDecode, scoreWords, tokenizeIpa } from '../../shared/ai/phonemes'
import { modelsConfig } from './stt'
import { PRON_MODEL } from './tiers'

export { WORD_OK_PER } from '../../shared/ai/phonemes'

const SAMPLE_RATE = 16000
const MIN_SECONDS = 0.5

const modelFile = (cacheDir: string): string =>
  join(cacheDir, PRON_MODEL, 'onnx/model_quantized.onnx')
const vocabFile = (cacheDir: string): string => join(cacheDir, PRON_MODEL, 'vocab.json')
export const pronunciationModelReady = (cacheDir: string): boolean =>
  existsSync(modelFile(cacheDir)) && existsSync(vocabFile(cacheDir))

/** transformers.js never fetches vocab.json (no tokenizer.json in this repo), so we do it ourselves. */
export async function fetchVocab(cacheDir: string): Promise<void> {
  const vf = vocabFile(cacheDir)
  if (existsSync(vf)) return
  const res = await fetch(`https://huggingface.co/${PRON_MODEL}/resolve/main/vocab.json`)
  if (!res.ok) throw new Error(`vocab.json: HTTP ${res.status}`)
  await writeFile(`${vf}.part`, await res.text())
  await rename(`${vf}.part`, vf) // a half-written vocab.json must never look ready
}

type Loaded = {
  heard(samples: Float32Array): Promise<string[]>
  vocab: Set<string>
  dispose(): Promise<void>
}

async function load(): Promise<Loaded> {
  const { cacheDir, allowRemote } = modelsConfig()
  const { env, AutoModelForCTC, Wav2Vec2FeatureExtractor } =
    await import('@huggingface/transformers')
  env.cacheDir = cacheDir
  env.allowRemoteModels = allowRemote
  const model = await AutoModelForCTC.from_pretrained(PRON_MODEL, { dtype: 'q8' })
  const extractor = await Wav2Vec2FeatureExtractor.from_pretrained(PRON_MODEL)

  await fetchVocab(cacheDir)
  const tokenToId = JSON.parse(await readFile(vocabFile(cacheDir), 'utf8')) as Record<
    string,
    number
  >
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
    vocab: new Set(idToToken.filter((t) => t && !/^<.*>$/.test(t))),
    dispose: async () => void (await model.dispose())
  }
}

export function createPronunciationScorer(): {
  score(samples: Float32Array, expectedText: string): Promise<PronunciationResult | null>
  dispose(): Promise<void>
} {
  let loading: Promise<Loaded> | null = null
  return {
    async score(samples, expectedText) {
      if (samples.length < MIN_SECONDS * SAMPLE_RATE) return null
      const { cacheDir, allowRemote } = modelsConfig()
      if (!allowRemote && !pronunciationModelReady(cacheDir)) {
        throw new Error(`Modelo de pronúncia não encontrado em ${cacheDir}`)
      }
      // A failed load is retried on the next call.
      const l = await (loading ??= load().catch((e) => {
        loading = null
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
    },
    async dispose() {
      const l = await loading?.catch(() => null)
      loading = null
      await l?.dispose()
    }
  }
}
