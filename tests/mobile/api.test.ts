import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createMobileApi } from '../../src/mobile/api'
import type { PronunciationResult } from '../../src/shared/api'
import type { ProfileProgress } from '../../src/shared/progress'
import { encodeWav } from '../../src/shared/wav'
import { memFs } from './memfs'

const track = (): { stop: ReturnType<typeof vi.fn> } => ({ stop: vi.fn() })
const stream = (t: ReturnType<typeof track>): MediaStream =>
  ({ getTracks: () => [t] }) as unknown as MediaStream

describe('ensureMic', () => {
  it('is false when the permission is refused', async () => {
    const api = createMobileApi({ getUserMedia: () => Promise.reject(new Error('denied')) })
    expect(await api.ensureMic()).toBe(false)
  })

  it('is true and releases the microphone', async () => {
    const t = track()
    const api = createMobileApi({ getUserMedia: async () => stream(t) })
    expect(await api.ensureMic()).toBe(true)
    expect(t.stop).toHaveBeenCalled()
  })
})

describe('loadCourse', () => {
  it('builds the real course from files served like the WebView does', async () => {
    const fakeFetch = (async (url: string) => {
      const path = url.replace(/^content\//, '')
      if (path === 'units/index.json')
        return new Response(JSON.stringify(readdirSync('content/units').sort()))
      return existsSync(`content/${path}`)
        ? new Response(readFileSync(`content/${path}`, 'utf8'))
        : new Response('', { status: 404 })
    }) as unknown as typeof fetch
    const course = await createMobileApi({ fetch: fakeFetch }).loadCourse()
    expect(course.units).toHaveLength(60)
  })
})

describe('copies at the boundary like IPC', () => {
  it('a later createProfile or saveProgress does not mutate what loadState returned', async () => {
    const api = createMobileApi({ fs: memFs() })
    const { state } = await api.loadState()
    const profile = await api.createProfile('Tati')
    expect(state.profiles).toEqual([])
    const progress = { profileId: profile.id, level: 'A1' } as unknown as ProfileProgress
    await api.saveProgress(progress)
    ;(profile as { name: string }).name = 'mutated'
    progress.level = 'B2'
    const again = (await api.loadState()).state
    expect(state.progress).toEqual({})
    expect(again.profiles[0].name).toBe('Tati')
    expect(again.progress[profile.id].level).toBe('A1')
  })
})

describe('urls', () => {
  it('points audio at the bundled content', () => {
    expect(createMobileApi().audioUrl('a.mp3')).toBe('content/audio/a.mp3')
  })
})

describe('transcribe', () => {
  const wav = encodeWav(new Float32Array(16000), 16000)
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- test helper
  const ready = async (pron: boolean) => {
    const fs = memFs()
    await fs.write(
      'models/ai-state.json',
      JSON.stringify({ hardware: null, rtf: 0.5, pronunciationEnabled: pron, llm: false })
    )
    const ai = {
      has: async () => true,
      download: async () => {},
      benchmark: async () => 1,
      dispose: async () => {},
      transcribe: vi.fn(async () => 'hello'),
      score: vi.fn(async (): Promise<PronunciationResult | null> => {
        throw new Error('boom')
      })
    }
    const api = createMobileApi({ fs, ai, detect: () => Promise.reject(new Error('no plugin')) })
    return { api, ai }
  }

  it('prompts with expected, else hint, and survives a pronunciation failure', async () => {
    const { api, ai } = await ready(true)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await api.transcribe(wav, ' Hello ', 'hint')).toEqual({ ok: true, text: 'hello' })
    expect(ai.transcribe).toHaveBeenLastCalledWith(expect.any(Float32Array), 'Hello')
    expect(await api.transcribe(wav, undefined, 'hint')).toEqual({ ok: true, text: 'hello' })
    expect(ai.transcribe).toHaveBeenLastCalledWith(expect.any(Float32Array), 'hint')
    expect(ai.score).toHaveBeenCalledTimes(1)
  })

  it('skips pronunciation when the setup turned it off', async () => {
    const { api, ai } = await ready(false)
    await api.transcribe(wav, 'Hello')
    expect(ai.score).not.toHaveBeenCalled()
  })
})
