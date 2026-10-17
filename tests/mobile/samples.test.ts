import { expect, test } from 'vitest'
import { createMobileSamples } from '../../src/mobile/samples'
import { memFs } from './memfs'

const sample = {
  exerciseId: 'u1#1',
  mode: 'repeat',
  expected: 'hello',
  transcript: 'hello',
  verdict: 'correct',
  wav: new Uint8Array([1, 2, 3])
} as unknown as Parameters<ReturnType<typeof createMobileSamples>['save']>[0]

test('off by default: save writes nothing', async () => {
  const fs = memFs()
  await createMobileSamples(fs).save(sample)
  expect(fs.files.size).toBe(0)
})

test('on: wav + jsonl line; remove deletes the folder', async () => {
  const fs = memFs()
  const s = createMobileSamples(fs)
  await s.setSaveSamples(true)
  expect(await s.getSettings()).toEqual({ saveSamples: true })
  await s.save(sample)
  const keys = [...fs.files.keys()]
  expect(keys.some((k) => /^amostras\/.*\.wav$/.test(k))).toBe(true)
  expect(fs.files.get('amostras/amostras.jsonl')).toContain('"exerciseId":"u1#1"')
  await s.remove()
  expect([...fs.files.keys()]).toEqual(['settings.json'])
})
