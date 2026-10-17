import { z } from 'zod'
import type { FreeSpeakEval, FreeSpeakInput } from '../api'

export const SCHEMA = {
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
