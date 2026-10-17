import { registerPlugin } from '@capacitor/core'
import type { FreeSpeakEval, FreeSpeakInput } from '../shared/api'
import { buildPrompt, parseEval } from '../shared/ai/freeSpeak'

export interface NativeLlm {
  load(modelPath: string): Promise<void> // file:// or absolute path
  complete(o: {
    prompt: string
    grammar: string
    maxTokens: number
    temperature: number
    seed: number
  }): Promise<string>
  stop(): Promise<void> // interrupts the running generation
  release(): Promise<void>
}

/** Our own JNI plugin (android/app/src/main/java/.../LlamaPlugin.java). */
export const Llama = registerPlugin<{
  load(o: { modelPath: string; nCtx: number }): Promise<{ ms: number }>
  complete(
    o: Parameters<NativeLlm['complete']>[0]
  ): Promise<{ text: string; tokens: number; ms: number }>
  stop(): Promise<void>
  release(): Promise<void>
  deviceInfo(): Promise<{ totalRam: number; cores: number; cpuModel: string }>
}>('Llama')

export function createNativeLlm(): NativeLlm {
  return {
    async load(modelPath) {
      const { ms } = await Llama.load({ modelPath, nCtx: 2048 })
      console.info('llm loaded', `${Math.round(ms)} ms`)
    },
    async complete(o) {
      const r = await Llama.complete(o)
      console.info('llm complete', `${r.tokens} tokens`, `${Math.round(r.ms)} ms`)
      return r.text
    },
    stop: () => Llama.stop(),
    release: () => Llama.release()
  }
}

/** Qwen ChatML with thinking off (an empty think block opens the answer). */
export const qwenPrompt = (user: string): string =>
  `<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`

/** SCHEMA from shared/ai/freeSpeak written by hand as GBNF (node-llama-cpp builds it on desktop). */
export const FREE_SPEAK_GBNF = String.raw`root ::= "{" ws "\"correct\"" ws ":" ws boolean ws "," ws "\"feedback_pt\"" ws ":" ws string ws "," ws "\"corrected_en\"" ws ":" ws string ws "}"
boolean ::= "true" | "false"
string ::= "\"" ( [^"\\\x7F\x00-\x1F] | "\\" ["\\/bfnrt] )* "\""
ws ::= [ \t\n]{0,2}
`

export const MOBILE_FREE_SPEAK_TIMEOUT_MS = 90_000

export function createMobileFreeSpeak(
  llm: NativeLlm,
  modelPath: () => Promise<string | null>
): { evaluate(input: FreeSpeakInput): Promise<FreeSpeakEval>; dispose(): Promise<void> } {
  let loaded: string | null = null
  // Tail of the last generation: the next one starts only after it really ended (even after a timeout).
  let queue: Promise<unknown> = Promise.resolve()

  async function run(
    input: FreeSpeakInput
  ): Promise<{ r: FreeSpeakEval; done?: Promise<unknown> }> {
    const path = await modelPath()
    if (!path)
      return { r: { ok: false, reason: 'no-model', message: 'A IA ainda não foi preparada.' } }
    try {
      if (loaded !== path) {
        if (loaded) await llm.release()
        loaded = null
        await llm.load(path)
        loaded = path
      }
      const gen = llm.complete({
        prompt: qwenPrompt(buildPrompt(input)),
        grammar: FREE_SPEAK_GBNF,
        maxTokens: 300,
        temperature: 0,
        seed: 1
      })
      let timer: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<null>(
        (res) => (timer = setTimeout(res, MOBILE_FREE_SPEAK_TIMEOUT_MS, null))
      )
      const out = await Promise.race([gen, timeout]).finally(() => clearTimeout(timer))
      if (out === null) {
        await llm.stop().catch(() => {})
        return {
          r: { ok: false, reason: 'timeout', message: 'A correção demorou demais.' },
          done: gen.catch(() => {})
        }
      }
      return { r: parseEval(out) }
    } catch (e) {
      return { r: { ok: false, reason: 'failed', message: String(e) } }
    }
  }

  return {
    evaluate(input) {
      const p = queue.then(() => run(input))
      queue = p.then((x) => x.done)
      return p.then((x) => x.r)
    },
    async dispose() {
      await queue
      if (loaded) await llm.release().catch(() => {})
      loaded = null
    }
  }
}
