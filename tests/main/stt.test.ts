import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { STT_MODEL } from '../../src/main/ai/tiers'
import { cleanTranscript, configureModels, createTranscriber } from '../../src/main/ai/stt'
import { checkAnswer } from '../../src/shared/matcher'
import { decodeWav } from '../../src/shared/wav'

const cacheDir = join(homedir(), '.cache/ingles-models')
const download = process.env.INGLES_DOWNLOAD_MODELS === '1'
const modelCached = existsSync(
  join(cacheDir, STT_MODEL, 'onnx/decoder_model_merged_quantized.onnx')
)

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

test.skipIf(!modelCached && !download)(
  'real whisper transcribes the fixture',
  async () => {
    configureModels(cacheDir, download)
    const t = createTranscriber()
    const { samples } = decodeWav(
      new Uint8Array(readFileSync(join(__dirname, '../fixtures/age.wav')))
    )
    const r = await t.transcribe(samples)
    await t.dispose()
    expect(
      r.ok &&
        checkAnswer(r.text, { accepted: ['I am twenty-five years old'], commonErrors: [] }).verdict
    ).toBe('correct')
  },
  300_000
)
