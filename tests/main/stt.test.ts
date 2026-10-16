import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { STT_BY_TIER, STT_MODEL } from '../../src/main/ai/tiers'
import {
  cleanTranscript,
  configureModels,
  createTranscriber,
  sttModelFile
} from '../../src/main/ai/stt'
import { checkAnswer } from '../../src/shared/matcher'
import { decodeWav } from '../../src/shared/wav'

const cacheDir = process.env.INGLES_MODELS_DIR ?? join(homedir(), '.cache/ingles-models')
const download = process.env.INGLES_DOWNLOAD_MODELS === '1'
const cached = (repo: string): boolean => existsSync(sttModelFile(cacheDir, repo))
const age = (): Float32Array =>
  decodeWav(new Uint8Array(readFileSync(join(__dirname, '../fixtures/age.wav')))).samples
const accepted = { accepted: ['I am twenty-five years old'], commonErrors: [] }

test('cleanTranscript drops blank/noise markers', () => {
  expect(cleanTranscript(' [BLANK_AUDIO]\n')).toBe('')
  expect(cleanTranscript(' Hello there.\n (music)\n How are you?')).toBe(
    'Hello there. How are you?'
  )
  expect(cleanTranscript('[00:00:00.000 --> 00:00:02.000]  Hi.')).toBe('Hi.')
})

test('model absent and remote disallowed → no-model', async () => {
  configureModels(mkdtempSync(join(tmpdir(), 'ingles-empty-')), false)
  const t = createTranscriber()
  expect(await t.transcribe(new Float32Array(16000))).toMatchObject({
    ok: false,
    reason: 'no-model'
  })
  await t.dispose()
})

describe.each([STT_MODEL, STT_BY_TIER.strong])('real %s', (model) => {
  test.skipIf(!cached(model) && !download)(
    'transcribes the fixture, with and without the expected sentence as prompt',
    async () => {
      configureModels(cacheDir, download)
      const t = createTranscriber()
      const plain = await t.transcribe(age(), { model })
      const prompted = await t.transcribe(age(), { model, prompt: 'I am twenty-five years old.' })
      // a wrong expected sentence must not be echoed back: the audio still wins
      const wrong = await t.transcribe(age(), { model, prompt: 'I am thirty years old.' })
      await t.dispose()
      for (const r of [plain, prompted, wrong]) {
        expect(r.ok && checkAnswer(r.text, accepted).verdict).toBe('correct')
      }
    },
    600_000
  )
})
