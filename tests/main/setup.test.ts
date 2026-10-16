import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  truncateSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'
import type { AiProgress, Hardware } from '../../src/shared/api'
import { createAiSetup, type Downloader } from '../../src/main/ai/setup'
import { LLM_BY_TIER, PRON_MODEL, STT_MODEL, type ModelFile } from '../../src/main/ai/tiers'

const hw: Hardware = {
  platform: 'linux',
  arch: 'x64',
  totalMemGB: 16,
  cpuModel: 'x',
  cores: 8,
  hasDiscreteGpu: false
}

/** Sparse file: real GGUF sizes without using disk. */
const touch = (p: string, bytes = 1): void => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, '')
  truncateSync(p, bytes)
}

function fakeDownloader(
  dir: string,
  o: {
    failGguf?: boolean
    ggufBytes?: (m: ModelFile) => number
    onGguf?: (m: ModelFile) => void
  } = {}
): Downloader & { hfCalls: string[] } {
  const hfCalls: string[] = []
  return {
    hfCalls,
    async hf(repo, onPct) {
      hfCalls.push(repo)
      onPct(50)
      if (repo === STT_MODEL)
        touch(join(dir, STT_MODEL, 'onnx/decoder_model_merged_quantized.onnx'))
      if (repo === PRON_MODEL) {
        touch(join(dir, PRON_MODEL, 'onnx/model_quantized.onnx'))
        touch(join(dir, PRON_MODEL, 'vocab.json'))
      }
      onPct(100)
    },
    async gguf(m, dest, onPct) {
      o.onGguf?.(m)
      touch(dest, Math.round(m.bytes / 2))
      onPct(50)
      if (o.failGguf) throw new Error('network down')
      touch(dest, o.ggufBytes ? o.ggufBytes(m) : m.bytes)
      onPct(100)
    }
  }
}

const make = (dir: string, downloader: Downloader, rtf = 0.5): ReturnType<typeof createAiSetup> =>
  createAiSetup({
    modelsDir: dir,
    downloader,
    detect: async () => hw,
    benchmark: async () => rtf
  })

const tmp = (): string => mkdtempSync(join(tmpdir(), 'ingles-setup-'))

test('full run writes state and everything is ready', async () => {
  const dir = tmp()
  const setup = make(dir, fakeDownloader(dir))
  expect((await setup.status()).ready).toEqual({ stt: false, pronunciation: false, llm: false })
  const s = await setup.run(undefined, () => {})
  expect(s).toMatchObject({
    tier: 'medium', // 16 GB + rtf 0.5
    hardware: hw,
    rtf: 0.5,
    ready: { stt: true, pronunciation: true, llm: true },
    pronunciationEnabled: true
  })
  expect(existsSync(join(dir, 'ai-state.json'))).toBe(true)
  expect(await make(dir, fakeDownloader(dir)).status()).toEqual(s)
})

test('download failing midway leaves no state nor final file, next run completes', async () => {
  const dir = tmp()
  const events: AiProgress[] = []
  const s = await make(dir, fakeDownloader(dir, { failGguf: true })).run('light', (p) =>
    events.push(p)
  )
  expect(events.at(-1)?.phase).toBe('error')
  expect(events.at(-1)?.message).toMatch(/Falha/)
  expect(s.tier).toBeNull()
  expect(existsSync(join(dir, 'ai-state.json'))).toBe(false)
  expect(existsSync(join(dir, LLM_BY_TIER.light.file))).toBe(false)
  expect(readdirSync(dir).filter((f) => f.endsWith('.part')).length).toBeLessThanOrEqual(1)

  const ok = await make(dir, fakeDownloader(dir)).run('light', () => {})
  expect(ok.ready).toEqual({ stt: true, pronunciation: true, llm: true })
  expect(readdirSync(dir).filter((f) => f.endsWith('.part'))).toEqual([])
})

test('wrong GGUF size → error and file not promoted', async () => {
  const dir = tmp()
  const events: AiProgress[] = []
  const s = await make(
    dir,
    fakeDownloader(dir, { ggufBytes: (m) => Math.round(m.bytes * 0.98) })
  ).run('light', (p) => events.push(p))
  expect(events.at(-1)?.phase).toBe('error')
  expect(s.ready.llm).toBe(false)
  expect(existsSync(join(dir, LLM_BY_TIER.light.file))).toBe(false)
  expect(existsSync(join(dir, 'ai-state.json'))).toBe(false)
})

test('rtf 1.2 → pronunciation not downloaded and disabled', async () => {
  const dir = tmp()
  const d = fakeDownloader(dir)
  const s = await make(dir, d, 1.2).run(undefined, () => {})
  expect(d.hfCalls).toEqual([STT_MODEL])
  expect(s.pronunciationEnabled).toBe(false)
  expect(s.ready.pronunciation).toBe(false)
  expect(s.ready.llm).toBe(true)
})

test('switching light → medium keeps light until medium is ready, then removes it', async () => {
  const dir = tmp()
  await make(dir, fakeDownloader(dir)).run('light', () => {})
  const lightPath = join(dir, LLM_BY_TIER.light.file)
  let lightDuringMedium = false
  const s = await make(
    dir,
    fakeDownloader(dir, { onGguf: () => (lightDuringMedium = existsSync(lightPath)) })
  ).run('medium', () => {})
  expect(lightDuringMedium).toBe(true)
  expect(s.tier).toBe('medium')
  expect(s.ready.llm).toBe(true)
  expect(existsSync(lightPath)).toBe(false)
  expect(existsSync(join(dir, LLM_BY_TIER.medium.file))).toBe(true)
})

test('phases are emitted in order stt → benchmark → pronunciation → llm → done', async () => {
  const dir = tmp()
  const phases: string[] = []
  await make(dir, fakeDownloader(dir)).run(undefined, (p) => {
    if (phases.at(-1) !== p.phase) phases.push(p.phase)
  })
  expect(phases).toEqual(['stt', 'benchmark', 'pronunciation', 'llm', 'done'])
})
