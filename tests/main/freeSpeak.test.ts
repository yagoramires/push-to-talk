import { existsSync, mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { LLM_BY_TIER } from '../../src/main/ai/tiers'
import { buildPrompt, createFreeSpeakEvaluator, parseEval } from '../../src/main/ai/freeSpeak'

const input = {
  prompt_en: 'What do you do on weekends?',
  guidelines_pt: ['Usar presente simples', 'Citar pelo menos duas atividades'],
  transcript: 'On weekends I play soccer and I visit my family'
}
const json =
  '{"correct":true,"feedback_pt":"Muito bem!","corrected_en":"On weekends I play soccer."}'

const llmPath = join(homedir(), '.cache/ingles-models', LLM_BY_TIER.light.file)
const llmCached = existsSync(llmPath)

test('buildPrompt includes the question, every guideline and the transcript', () => {
  const p = buildPrompt(input)
  expect(p).toContain(input.prompt_en)
  for (const g of input.guidelines_pt) expect(p).toContain(g)
  expect(p).toContain(input.transcript)
})

test('parseEval accepts valid JSON', () => {
  expect(parseEval(json)).toEqual({
    ok: true,
    correct: true,
    feedback_pt: 'Muito bem!',
    corrected_en: 'On weekends I play soccer.'
  })
})

test('parseEval strips a <think> block before the JSON', () => {
  expect(parseEval(`<think>\nhmm\n</think>\n\n${json}`)).toMatchObject({ ok: true, correct: true })
})

test('parseEval rejects garbage and empty feedback', () => {
  expect(parseEval('not json at all')).toMatchObject({ ok: false, reason: 'failed' })
  expect(parseEval('{"correct":true}')).toMatchObject({ ok: false, reason: 'failed' })
  expect(parseEval(json.replace('Muito bem!', '  '))).toMatchObject({ ok: false, reason: 'failed' })
})

test('missing model file → no-model', async () => {
  const e = createFreeSpeakEvaluator(join(mkdtempSync(join(tmpdir(), 'ingles-llm-')), 'x.gguf'))
  expect(await e.evaluate(input)).toMatchObject({ ok: false, reason: 'no-model' })
  await e.dispose()
})

test.skipIf(!llmCached)(
  'real light model approves a good answer (and serializes concurrent calls)',
  async () => {
    const e = createFreeSpeakEvaluator(llmPath)
    const t0 = Date.now()
    const [a, b] = await Promise.all([e.evaluate(input), e.evaluate(input)])
    console.log(`freeSpeak: load+2 calls ${Date.now() - t0} ms`)
    const t1 = Date.now()
    await e.evaluate(input)
    console.log(`freeSpeak: warm call ${Date.now() - t1} ms`)
    console.log(JSON.stringify(a))
    expect(a).toMatchObject({ ok: true, correct: true })
    if (a.ok) expect(a.feedback_pt.trim()).not.toBe('')
    expect(b).toEqual(a) // temperature 0 + fresh session per call → deterministic
    await e.dispose()
  },
  240_000
)
