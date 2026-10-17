import { existsSync } from 'node:fs'
import type { Llama, LlamaGrammar, LlamaModel } from 'node-llama-cpp'
import type { FreeSpeakEval, FreeSpeakInput } from '../../shared/api'
import { SCHEMA, buildPrompt, parseEval } from '../../shared/ai/freeSpeak'

export const FREE_SPEAK_TIMEOUT_MS = 60_000

type Loaded = { llama: Llama; model: LlamaModel; grammar: LlamaGrammar }

export function createFreeSpeakEvaluator(modelPath: string): {
  evaluate(input: FreeSpeakInput): Promise<FreeSpeakEval>
  dispose(): Promise<void>
} {
  let loading: Promise<Loaded> | null = null
  let queue: Promise<unknown> = Promise.resolve()

  async function load(): Promise<Loaded> {
    // ESM-only package: dynamic import also works from the CJS main bundle.
    const { getLlama } = await import('node-llama-cpp')
    const llama = await getLlama()
    const model = await llama.loadModel({ modelPath })
    const grammar = await llama.createGrammarForJsonSchema(SCHEMA)
    return { llama, model, grammar }
  }

  async function run(input: FreeSpeakInput): Promise<FreeSpeakEval> {
    if (!existsSync(modelPath)) {
      return { ok: false, reason: 'no-model', message: `Modelo não encontrado em ${modelPath}` }
    }
    const signal = AbortSignal.timeout(FREE_SPEAK_TIMEOUT_MS)
    try {
      const { LlamaChatSession } = await import('node-llama-cpp')
      // Reuse the loaded model; a failed load is retried on the next call.
      const l = await (loading ??= load().catch((e) => {
        loading = null
        throw e
      }))
      // Fresh context + session per call: no chat history leaks between answers.
      const ctx = await l.model.createContext({ contextSize: 2048 })
      try {
        const session = new LlamaChatSession({ contextSequence: ctx.getSequence() })
        const out = await session.prompt(buildPrompt(input), {
          grammar: l.grammar,
          maxTokens: 300,
          temperature: 0,
          seed: 1,
          budgets: { thoughtTokens: 0 }, // Qwen3.5: thinking off
          signal
        })
        return parseEval(out)
      } finally {
        await ctx.dispose()
      }
    } catch (e) {
      if (signal.aborted) {
        return { ok: false, reason: 'timeout', message: 'A correção demorou demais.' }
      }
      return { ok: false, reason: 'failed', message: String(e) }
    }
  }

  return {
    // One generation at a time.
    evaluate(input) {
      const p = queue.then(() => run(input))
      queue = p.catch(() => undefined)
      return p
    },
    async dispose() {
      await queue
      const l = await loading?.catch(() => null)
      loading = null
      await l?.model.dispose()
      await l?.llama.dispose()
    }
  }
}
