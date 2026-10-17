import type { AiProgress, AiStatus, Hardware } from '../shared/api'
import { LLM_BY_TIER, PRON_MODEL, STT_BASE, type ModelFile } from '../shared/models'
import type { TextFs } from './fs'
import { chooseMobileSetup } from './tier'

export type MobileSetupDeps = {
  fs: TextFs
  /** transformers.js models live in the Cache API (inside the worker). */
  models: {
    has(repo: string): Promise<boolean>
    download(repo: string, onPct: (p: number) => void): Promise<void>
    benchmark(): Promise<number>
  }
  /** Downloads the GGUF to a TextFs path (natively, never through the JS bridge). */
  gguf(m: ModelFile, path: string, onPct: (p: number) => void): Promise<void>
  detect(): Promise<Hardware>
  persist(): Promise<boolean>
}

type AiState = { hardware: Hardware; rtf: number; pronunciationEnabled: boolean; llm: boolean }

const STATE = 'models/ai-state.json'
const LLM = LLM_BY_TIER.light
const GGUF = `models/${LLM.file}`

export function createMobileSetup(o: MobileSetupDeps): {
  status(): Promise<AiStatus>
  run(onProgress: (p: AiProgress) => void): Promise<AiStatus>
  /** file:// of the GGUF when setup chose the LLM and the file is there; else null. */
  modelPath(): Promise<string | null>
} {
  const readState = async (): Promise<AiState | null> => {
    try {
      return JSON.parse((await o.fs.read(STATE)) ?? 'null')
    } catch {
      return null
    }
  }
  const llmReady = async (s: AiState | null): Promise<boolean> =>
    !!s?.llm && (await o.fs.size(GGUF)) !== undefined

  async function status(): Promise<AiStatus> {
    const s = await readState()
    const hardware = (await o.detect().catch(() => null)) ?? s?.hardware ?? null
    return {
      tier: s ? 'light' : null,
      hardware,
      recommended: hardware && 'light',
      rtf: s?.rtf ?? null,
      ready: {
        stt: await o.models.has(STT_BASE).catch(() => false),
        pronunciation: await o.models.has(PRON_MODEL).catch(() => false),
        llm: await llmReady(s)
      },
      pronunciationEnabled: s?.pronunciationEnabled ?? false
    }
  }

  async function run(onProgress: (p: AiProgress) => void): Promise<AiStatus> {
    // One event per whole percent, like the desktop.
    const step = (phase: AiProgress['phase'], message: string): ((p: number) => void) => {
      let last = -1
      const f = (p: number): void => {
        const percent = Math.floor(p)
        if (percent !== last) onProgress({ phase, percent: (last = percent), message })
      }
      f(0)
      return f
    }
    try {
      // Without it the browser may evict the cached models when space runs low.
      const persisted = await o.persist().catch(() => false)
      const hardware = await o.detect()

      await o.models.download(STT_BASE, step('stt', 'Baixando o reconhecimento de fala…'))
      step('benchmark', 'Medindo a velocidade do celular…')
      const rtf = await o.models.benchmark()
      const choice = chooseMobileSetup(hardware, rtf)
      console.info(
        'setupAi decision',
        `rtf=${rtf.toFixed(2)}`,
        `ram=${hardware.totalMemGB}GB`,
        `cores=${hardware.cores}`,
        `pronunciation=${choice.pronunciation}`,
        `llm=${choice.llm}`,
        `persisted=${persisted}`
      )

      if (choice.pronunciation)
        await o.models.download(
          PRON_MODEL,
          step('pronunciation', 'Baixando a avaliação de pronúncia…')
        )

      if (choice.llm) {
        const llm = step('llm', 'Baixando o modelo de linguagem…')
        if ((await o.fs.size(GGUF)) === undefined) {
          const part = `${GGUF}.part`
          await o.gguf(LLM, part, llm)
          const size = (await o.fs.size(part)) ?? 0
          if (Math.abs(size - LLM.bytes) > LLM.bytes * 0.01) {
            await o.fs.remove(part)
            throw new Error(`o arquivo do modelo veio com tamanho inesperado (${size} bytes)`)
          }
          await o.fs.rename(part, GGUF)
        }
      }

      const state: AiState = {
        hardware,
        rtf,
        pronunciationEnabled: choice.pronunciation,
        llm: choice.llm
      }
      await o.fs.write(`${STATE}.tmp`, JSON.stringify(state))
      await o.fs.rename(`${STATE}.tmp`, STATE)
      onProgress({ phase: 'done', percent: 100, message: 'IA pronta.' })
    } catch (e) {
      onProgress({
        phase: 'error',
        percent: 0,
        message: `Falha ao preparar a IA: ${e instanceof Error ? e.message : String(e)}`
      })
    }
    return status()
  }

  return {
    status,
    run,
    async modelPath() {
      return (await llmReady(await readState())) ? o.fs.uri(GGUF) : null
    }
  }
}
