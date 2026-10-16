import { join } from 'node:path'
import { expect, test } from 'vitest'
import { resourcePaths, selfCheck } from '../../src/main/self-check'

const repo = join(__dirname, '../..')
const content = join(repo, 'content')
const benchmarkWav = join(repo, 'resources/benchmark.wav')
const importOk = async (): Promise<unknown> => ({})

test('resourcePaths: packaged reads from resourcesPath', () => {
  expect(resourcePaths({ packaged: true, resourcesPath: '/r', appPath: '/a' })).toEqual({
    content: join('/r', 'content'),
    benchmarkWav: join('/r', 'benchmark.wav')
  })
})

test('resourcePaths: dev reads from appPath', () => {
  expect(resourcePaths({ packaged: false, resourcesPath: '/r', appPath: '/a' })).toEqual({
    content: join('/a', 'content'),
    benchmarkWav: join('/a', 'resources/benchmark.wav')
  })
})

test('selfCheck passes with the repo course, benchmark and importable modules', async () => {
  const r = await selfCheck({ content, benchmarkWav, importModule: importOk })
  expect(r.ok).toBe(true)
  expect(r.lines).toHaveLength(6)
  for (const line of r.lines) expect(line).toMatch(/^OK /)
})

test('selfCheck fails on a missing course and names the path', async () => {
  const missing = join(repo, 'nao-existe')
  const r = await selfCheck({ content: missing, benchmarkWav, importModule: importOk })
  expect(r.ok).toBe(false)
  const line = r.lines.find((l) => l.startsWith('FALHOU curso'))
  expect(line).toContain(missing)
})

test('selfCheck reports a failed import and still runs the other steps', async () => {
  const r = await selfCheck({
    content,
    benchmarkWav,
    importModule: async (n) => {
      if (n === 'node-llama-cpp') throw new Error('boom')
      return {}
    }
  })
  expect(r.ok).toBe(false)
  expect(r.lines).toHaveLength(6)
  expect(r.lines).toContain('FALHOU node-llama-cpp: boom')
  expect(r.lines.filter((l) => l.startsWith('OK '))).toHaveLength(5)
})
