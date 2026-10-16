import { existsSync } from 'node:fs'
import { z } from 'zod'
import type { Llama, LlamaGrammar, LlamaModel } from 'node-llama-cpp'
import type { FreeSpeakEval, FreeSpeakInput } from '../../shared/api'

export const FREE_SPEAK_TIMEOUT_MS = 60_000

const SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    feedback_pt: { type: 'string' },
    corrected_en: { type: 'string' }
  },
  required: ['correct', 'feedback_pt', 'corrected_en']
} as const

const Eval = z.object({
  correct: z.boolean(),
  feedback_pt: z.string().trim().min(1),
  corrected_en: z.string()
})

export function buildPrompt({ prompt_en, guidelines_pt, transcript }: FreeSpeakInput): string {
  return `Você é um professor de inglês para brasileiros. O aluno respondeu em voz alta a uma pergunta em inglês; abaixo está a transcrição automática da fala dele.

Pergunta: ${prompt_en}

Diretrizes da aula:
${guidelines_pt.map((g) => `- ${g}`).join('\n')}

O aluno disse: "${transcript}"

Julgue se a resposta atende às diretrizes e é compreensível. Pequenos erros (artigos, preposições, pequenas falhas de gramática ou da transcrição) NÃO reprovam: na dúvida, aprove.

Responda em JSON com:
- correct: true se a resposta atende às diretrizes e é compreensível, senão false;
- feedback_pt: no máximo 2 frases, em português do Brasil, com o feedback para o aluno;
- corrected_en: a resposta do aluno corrigida, em inglês.`
}

/** Strips a leading <think> block (Qwen) and validates the JSON the grammar should have forced. */
export function parseEval(raw: string): FreeSpeakEval {
  const json = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  // Qwen3.5 with thinking off (node-llama-cpp 3.22.1 + grammar) returns the object without its
  // opening "{" (observed with the 2B model), so retry with it restored.
  for (const candidate of [json, `{${json}`]) {
    try {
      const r = Eval.parse(JSON.parse(candidate))
      return {
        ok: true,
        correct: r.correct,
        feedback_pt: r.feedback_pt,
        corrected_en: r.corrected_en
      }
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, reason: 'failed', message: 'Resposta inválida do modelo local.' }
}

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
