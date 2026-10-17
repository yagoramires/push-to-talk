import { expect, test } from 'vitest'
import type { AppState } from '../../src/shared/api'
import { createMobileStore } from '../../src/mobile/store'
import { memFs } from './memfs'

test('missing file loads empty state', async () => {
  const r = await createMobileStore(memFs()).load()
  expect(r.state).toEqual({ version: 1, profiles: [], progress: {} })
  expect(r.recoveredFrom).toBeUndefined()
})

test('save then load round-trips', async () => {
  const s = createMobileStore(memFs())
  const state = {
    version: 1 as const,
    profiles: [{ id: 'a', name: 'Ana', createdAt: '2026-01-01T00:00:00.000Z' }],
    progress: {}
  }
  await s.save(state)
  expect((await s.load()).state).toEqual(state)
})

test('corrupt file is backed up and reported', async () => {
  const fs = memFs()
  fs.files.set('state.json', '{ not json')
  const r = await createMobileStore(fs).load()
  expect(r.state.profiles).toEqual([])
  expect(r.recoveredFrom).toMatch(/^state\.corrupt-\d+\.json$/)
  expect(fs.files.get(r.recoveredFrom!)).toBe('{ not json')
  expect(fs.files.has('state.json')).toBe(false)
})

test('wrong shape is treated as corrupt', async () => {
  const fs = memFs()
  fs.files.set('state.json', JSON.stringify({ version: 2, profiles: [], progress: {} }))
  expect((await createMobileStore(fs).load()).recoveredFrom).toBeDefined()
})

test('two quick saves: the last one wins', async () => {
  const s = createMobileStore(memFs())
  const mk = (name: string): AppState => ({
    version: 1 as const,
    profiles: [{ id: 'a', name, createdAt: '2026-01-01T00:00:00.000Z' }],
    progress: {}
  })
  await Promise.all([s.save(mk('um')), s.save(mk('dois'))])
  expect((await s.load()).state.profiles[0].name).toBe('dois')
})
