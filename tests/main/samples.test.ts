import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { createSamples } from '../../src/main/samples'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'samples-'))
})

const sample = {
  exerciseId: 'a1-01/ex 3',
  mode: 'solo' as const,
  wav: new Uint8Array([1, 2, 3]),
  hint: "I'm from",
  transcript: "I'm from Brazil",
  verdict: 'correct' as const
}

test('off by default (missing or corrupt settings): nothing is saved', async () => {
  const s = createSamples(dir)
  expect(await s.getSettings()).toEqual({ saveSamples: false })
  await s.save(sample)
  expect(existsSync(s.dir)).toBe(false)
  await writeFile(join(dir, 'settings.json'), '{ nope')
  expect(await s.getSettings()).toEqual({ saveSamples: false })
})

test('when on, saves the wav and appends one JSON line per answer', async () => {
  const s = createSamples(dir)
  await s.setSaveSamples(true)
  expect(await createSamples(dir).getSettings()).toEqual({ saveSamples: true })
  await s.save(sample)
  await s.save({ ...sample, exerciseId: 'b', hint: undefined, expected: 'Hello', verdict: 'error' })
  const lines = (await readFile(join(s.dir, 'amostras.jsonl'), 'utf8')).trim().split('\n')
  expect(lines).toHaveLength(2)
  const first = JSON.parse(lines[0])
  expect(first).toMatchObject({
    exerciseId: 'a1-01/ex 3',
    mode: 'solo',
    hint: "I'm from",
    transcript: "I'm from Brazil",
    verdict: 'correct'
  })
  expect(first.wav).toMatch(/^[\dTZ-]+-a1-01_ex_3\.wav$/)
  expect(new Uint8Array(await readFile(join(s.dir, first.wav)))).toEqual(sample.wav)
  expect(JSON.parse(lines[1])).toMatchObject({ expected: 'Hello', verdict: 'error' })
  expect((await readdir(s.dir)).filter((f) => f.endsWith('.wav'))).toHaveLength(2)
})

test('delete removes the folder; turning off stops saving', async () => {
  const s = createSamples(dir)
  await s.setSaveSamples(true)
  await s.save(sample)
  await s.remove()
  expect(existsSync(s.dir)).toBe(false)
  await s.remove() // already gone: no error
  await s.setSaveSamples(false)
  await s.save(sample)
  expect(existsSync(s.dir)).toBe(false)
})
