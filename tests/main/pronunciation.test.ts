import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { PRON_MODEL } from '../../src/main/ai/tiers'
import { configureModels } from '../../src/main/ai/stt'
import { createPronunciationScorer } from '../../src/main/ai/pronunciation'
import { decodeWav } from '../../src/shared/wav'

const cacheDir = join(homedir(), '.cache/ingles-models')
const download = process.env.INGLES_DOWNLOAD_MODELS === '1'
const modelCached = existsSync(join(cacheDir, PRON_MODEL, 'onnx/model_quantized.onnx'))
const fixture = (name: string): Float32Array =>
  decodeWav(new Uint8Array(readFileSync(join(__dirname, '../fixtures', name)))).samples

const scorer = createPronunciationScorer()
afterAll(() => scorer.dispose())

test('audio shorter than 0.5 s → null', async () => {
  configureModels(mkdtempSync(join(tmpdir(), 'ingles-empty-')), false)
  expect(await scorer.score(new Float32Array(3200), 'hello')).toBeNull()
})

test('model absent and remote disallowed → rejects', async () => {
  configureModels(mkdtempSync(join(tmpdir(), 'ingles-empty-')), false)
  await expect(scorer.score(new Float32Array(16000), 'hello')).rejects.toThrow()
})

test.skipIf(!modelCached && !download)(
  'real model: matching text scores high, unrelated text low',
  async () => {
    configureModels(cacheDir, download)
    // age-native.wav: macOS Samantha (en-US). age.wav: this Mac's default voice, pt-BR Luciana reading English.
    const native = fixture('age-native.wav')
    const accented = fixture('age.wav')
    const good = await scorer.score(native, 'I am 25 years old!')
    const bad = await scorer.score(native, 'the weather is nice today')
    const accentGood = await scorer.score(accented, 'I am twenty five years old')
    const accentBad = await scorer.score(accented, 'the weather is nice today')
    console.log('pronunciation scores', JSON.stringify({ good, bad, accentGood, accentBad }))
    expect(good!.score).toBeGreaterThanOrEqual(70)
    expect(bad!.score).toBeLessThan(50)
    expect(accentGood!.score).toBeGreaterThan(accentBad!.score + 20)
    expect(good!.words.map((w) => w.word)).toEqual(['i', 'am', 'twenty', 'five', 'years', 'old'])
  },
  600_000
)
