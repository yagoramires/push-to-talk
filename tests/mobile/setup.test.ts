import { describe, expect, it, vi } from 'vitest'
import type { AiProgress, Hardware } from '../../src/shared/api'
import { LLM_BY_TIER } from '../../src/shared/models'
import { createMobileSetup, type MobileSetupDeps } from '../../src/mobile/setup'
import { memFs } from './memfs'

const GGUF = `models/${LLM_BY_TIER.light.file}`
const hw = (gb: number): Hardware => ({
  platform: 'android',
  arch: 'arm64',
  totalMemGB: gb,
  cpuModel: 'test',
  cores: 8,
  hasDiscreteGpu: false
})

function deps(o: { gb?: number; ggufBytes?: number } = {}): {
  d: MobileSetupDeps & { gguf: ReturnType<typeof vi.fn> }
  fs: ReturnType<typeof memFs>
} {
  const fs = memFs()
  const sizes = new Map<string, number>()
  // memFs measures string length; a 1.3 GB file is faked through this map.
  const size = fs.size
  fs.size = async (p) => sizes.get(p) ?? (await size(p))
  const cached = new Set<string>()
  const d = {
    fs,
    models: {
      has: async (repo) => cached.has(repo),
      download: vi.fn(async (repo: string, onPct: (p: number) => void) => {
        onPct(50)
        cached.add(repo)
      }),
      benchmark: async () => 0.5
    },
    gguf: vi.fn(async (_m, path: string) => {
      await fs.write(path, 'x')
      sizes.set(path, o.ggufBytes ?? LLM_BY_TIER.light.bytes)
    }),
    detect: async () => hw(o.gb ?? 8),
    persist: async () => true
  } satisfies MobileSetupDeps
  const origRename = fs.rename
  fs.rename = async (a, b) => {
    if (sizes.has(a)) sizes.set(b, sizes.get(a)!)
    sizes.delete(a)
    await origRename(a, b)
  }
  const origRemove = fs.remove
  fs.remove = async (p) => {
    sizes.delete(p)
    await origRemove(p)
  }
  return { d, fs }
}

const phases = (events: AiProgress[]): string[] =>
  events.map((e) => e.phase).filter((p, i, a) => a[i - 1] !== p)

describe('createMobileSetup', () => {
  it('runs every phase in order and ends ready', async () => {
    const { d } = deps()
    const events: AiProgress[] = []
    const s = await createMobileSetup(d).run((p) => events.push(p))
    expect(phases(events)).toEqual(['stt', 'benchmark', 'pronunciation', 'llm', 'done'])
    expect(s).toMatchObject({
      tier: 'light',
      rtf: 0.5,
      pronunciationEnabled: true,
      ready: { stt: true, pronunciation: true, llm: true }
    })
  })

  it('drops a GGUF of the wrong size and is not ready', async () => {
    const { d, fs } = deps({ ggufBytes: 1000 })
    const events: AiProgress[] = []
    const setup = createMobileSetup(d)
    const s = await setup.run((p) => events.push(p))
    expect(fs.files.has(`${GGUF}.part`)).toBe(false)
    expect(fs.files.has(GGUF)).toBe(false)
    expect(events.at(-1)?.phase).toBe('error')
    expect(s.ready.llm).toBe(false)
    expect(await setup.modelPath()).toBeNull()
  })

  it('skips the LLM download on a 4 GB phone', async () => {
    const { d } = deps({ gb: 4 })
    const setup = createMobileSetup(d)
    await setup.run(() => {})
    expect(d.gguf).not.toHaveBeenCalled()
    expect((await setup.status()).ready.llm).toBe(false)
    expect(await setup.modelPath()).toBeNull()
  })

  it('has no tier before setup', async () => {
    const { d } = deps()
    expect(await createMobileSetup(d).status()).toMatchObject({
      tier: null,
      recommended: 'light',
      ready: { stt: false, pronunciation: false, llm: false }
    })
  })

  it('needs the saved state and the file for the LLM to be ready', async () => {
    const { d, fs } = deps()
    const setup = createMobileSetup(d)
    await setup.run(() => {})
    expect(await setup.modelPath()).toBe(`file:///mem/${GGUF}`)
    await fs.remove(GGUF)
    expect((await setup.status()).ready.llm).toBe(false)
  })
})
