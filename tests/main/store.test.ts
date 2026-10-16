import { mkdtemp, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, expect, test } from 'vitest'
import { createStore } from '../../src/main/store'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'store-'))
})

test('missing file loads empty state', async () => {
  const r = await createStore(dir).load()
  expect(r.state).toEqual({ version: 1, profiles: [], progress: {} })
  expect(r.recoveredFrom).toBeUndefined()
})

test('save then load round-trips', async () => {
  const s = createStore(dir)
  const state = {
    version: 1 as const,
    profiles: [{ id: 'a', name: 'Ana', createdAt: '2026-01-01T00:00:00.000Z' }],
    progress: {}
  }
  await s.save(state)
  expect((await s.load()).state).toEqual(state)
})

test('corrupt file is backed up, not overwritten, and reported', async () => {
  await writeFile(join(dir, 'state.json'), '{ not json')
  const r = await createStore(dir).load()
  expect(r.state.profiles).toEqual([])
  expect(r.recoveredFrom).toMatch(/state\.corrupt-.*\.json$/)
  expect(await readFile(r.recoveredFrom!, 'utf8')).toBe('{ not json')
})

test('wrong version or shape is treated as corrupt', async () => {
  for (const bad of [
    { version: 2, profiles: [], progress: {} },
    { version: 1, profiles: {} }
  ]) {
    await writeFile(join(dir, 'state.json'), JSON.stringify(bad))
    const r = await createStore(dir).load()
    expect(r.recoveredFrom).toBeDefined()
    expect(r.state.profiles).toEqual([])
  }
})

test('concurrent saves leave the last state and no tmp file', async () => {
  const s = createStore(dir)
  await Promise.all(
    [1, 2, 3].map((n) =>
      s.save({ version: 1, profiles: [{ id: String(n), name: 'n', createdAt: 'x' }], progress: {} })
    )
  )
  expect((await s.load()).state.profiles[0].id).toBe('3')
  expect(existsSync(join(dir, 'state.json.tmp'))).toBe(false)
})
