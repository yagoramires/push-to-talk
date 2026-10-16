import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { checkAnswer } from '../../src/shared/matcher'
import {
  cleanWhisperOutput,
  createWhisperTranscriber,
  type Runner
} from '../../src/main/speech/whisper'

const defaultModel = join(homedir(), '.cache/whisper/ggml-small.bin')
const hasWhisperAndModel = existsSync('/opt/homebrew/bin/whisper-cli') && existsSync(defaultModel)
const fixture = (name: string): string => join(__dirname, '../fixtures', name)
const base = { bin: 'whisper-cli', model: '/m/model.bin', exists: () => true }

test('cleanWhisperOutput drops blank/noise markers', () => {
  expect(cleanWhisperOutput(' [BLANK_AUDIO]\n')).toBe('')
  expect(cleanWhisperOutput(' Hello there.\n (music)\n How are you?')).toBe(
    'Hello there. How are you?'
  )
  expect(cleanWhisperOutput('[00:00:00.000 --> 00:00:02.000]  Hi.')).toBe('Hi.')
})

test('missing binary → no-binary', async () => {
  const run: Runner = async () => {
    throw Object.assign(new Error('spawn'), { code: 'ENOENT' })
  }
  const r = await createWhisperTranscriber({ ...base, run }).transcribe('/a.wav')
  expect(r).toMatchObject({ ok: false, reason: 'no-binary' })
})

test('missing model → no-model, without calling run', async () => {
  let called = false
  const run: Runner = async () => {
    called = true
    return { code: 0, stdout: '', stderr: '' }
  }
  const r = await createWhisperTranscriber({ ...base, exists: () => false, run }).transcribe(
    '/a.wav'
  )
  expect(r).toMatchObject({ ok: false, reason: 'no-model' })
  expect(called).toBe(false)
})

test('non-zero exit → failed with stderr in message', async () => {
  const run: Runner = async () => ({ code: 2, stdout: '', stderr: 'boom' })
  const r = await createWhisperTranscriber({ ...base, run }).transcribe('/a.wav')
  expect(r.ok).toBe(false)
  expect(!r.ok && r.reason).toBe('failed')
  expect(!r.ok && r.message).toContain('boom')
})

test('success returns cleaned text and passes the expected args', async () => {
  let args: string[] = []
  const run: Runner = async (_bin, a) => {
    args = a
    return { code: 0, stdout: ' I am here.\n [BLANK_AUDIO]\n', stderr: '' }
  }
  const r = await createWhisperTranscriber({ ...base, run }).transcribe('/a.wav')
  expect(r).toEqual({ ok: true, text: 'I am here.' })
  expect(args).toEqual(['-m', '/m/model.bin', '-f', '/a.wav', '-l', 'en', '-nt', '-np'])
})

test.skipIf(!hasWhisperAndModel)('real whisper transcribes the fixture', async () => {
  const r = await createWhisperTranscriber({ bin: 'whisper-cli', model: defaultModel }).transcribe(
    fixture('age.wav')
  )
  expect(
    r.ok &&
      checkAnswer(r.text, { accepted: ['I am twenty-five years old'], commonErrors: [] }).verdict
  ).toBe('correct')
})
