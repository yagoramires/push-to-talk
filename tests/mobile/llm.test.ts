import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FREE_SPEAK_GBNF,
  MOBILE_FREE_SPEAK_TIMEOUT_MS,
  createMobileFreeSpeak,
  qwenPrompt,
  type NativeLlm
} from '../../src/mobile/llm-native'

const input = { prompt_en: 'Say hi', guidelines_pt: ['Cumprimente'], transcript: 'Hi' }

function fakeLlm(complete: NativeLlm['complete']): NativeLlm & { stop: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => {}),
    complete: vi.fn(complete),
    stop: vi.fn(async () => {}),
    release: vi.fn(async () => {})
  }
}

afterEach(() => vi.useRealTimers())

describe('createMobileFreeSpeak', () => {
  it('is no-model without a model file', async () => {
    const llm = fakeLlm(async () => '')
    const fs = createMobileFreeSpeak(llm, async () => null)
    expect(await fs.evaluate(input)).toMatchObject({ ok: false, reason: 'no-model' })
    expect(llm.load).not.toHaveBeenCalled()
  })

  it('times out and stops the generation', async () => {
    vi.useFakeTimers()
    let finish = (): void => {}
    const llm = fakeLlm(() => new Promise((res) => (finish = () => res(''))))
    llm.stop.mockImplementation(async () => finish())
    const p = createMobileFreeSpeak(llm, async () => 'file:///m.gguf').evaluate(input)
    await vi.advanceTimersByTimeAsync(MOBILE_FREE_SPEAK_TIMEOUT_MS + 1)
    expect(await p).toMatchObject({ ok: false, reason: 'timeout' })
    expect(llm.stop).toHaveBeenCalled()
  })

  it('never runs two generations at once, and loads the model once', async () => {
    let running = 0
    let max = 0
    const llm = fakeLlm(async () => {
      max = Math.max(max, ++running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return '{"correct":true,"feedback_pt":"Boa!","corrected_en":"Hi"}'
    })
    const fs = createMobileFreeSpeak(llm, async () => 'file:///m.gguf')
    const [a, b] = await Promise.all([fs.evaluate(input), fs.evaluate(input)])
    expect(a.ok && b.ok).toBe(true)
    expect(max).toBe(1)
    expect(llm.load).toHaveBeenCalledTimes(1)
  })

  it('accepts output missing its opening brace', async () => {
    const llm = fakeLlm(async () => '"correct":true,"feedback_pt":"Boa!","corrected_en":"Hi"}')
    const r = await createMobileFreeSpeak(llm, async () => 'file:///m.gguf').evaluate(input)
    expect(r).toEqual({ ok: true, correct: true, feedback_pt: 'Boa!', corrected_en: 'Hi' })
  })

  it('sends the ChatML prompt with thinking off, the grammar and fixed sampling', async () => {
    const llm = fakeLlm(async () => '{"correct":false,"feedback_pt":"x","corrected_en":"y"}')
    await createMobileFreeSpeak(llm, async () => 'file:///m.gguf').evaluate(input)
    const o = vi.mocked(llm.complete).mock.calls[0][0]
    expect(o.prompt.endsWith('<|im_start|>assistant\n<think>\n\n</think>\n\n')).toBe(true)
    expect(o).toMatchObject({ grammar: FREE_SPEAK_GBNF, maxTokens: 300, temperature: 0, seed: 1 })
    expect(qwenPrompt('a')).toBe(
      '<|im_start|>user\na<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n'
    )
  })
})

it('FREE_SPEAK_GBNF has the three SCHEMA keys in order', () => {
  expect(FREE_SPEAK_GBNF).toContain(String.raw`"\"correct\"" ws ":" ws boolean`)
  expect(FREE_SPEAK_GBNF.indexOf('feedback_pt')).toBeLessThan(
    FREE_SPEAK_GBNF.indexOf('corrected_en')
  )
  expect(FREE_SPEAK_GBNF).toContain(String.raw`[^"\\\x7F\x00-\x1F]`)
})
