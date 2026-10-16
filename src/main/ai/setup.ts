import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import type { AiProgress, AiStatus, Hardware, Tier } from '../../shared/api'
import { fetchVocab, pronunciationModelReady } from './pronunciation'
import { configureModels, modelsConfig, sttModelFile } from './stt'
import {
  LLM_BY_TIER,
  PRON_MODEL,
  STT_MODEL,
  chooseTier,
  pronunciationEnabled,
  type ModelFile
} from './tiers'

export type Downloader = {
  hf(repo: string, onPct: (p: number) => void): Promise<void>
  gguf(m: ModelFile, dest: string, onPct: (p: number) => void): Promise<void>
}

type AiState = { tier: Tier; hardware: Hardware; rtf: number; pronunciationEnabled: boolean }

export function createAiSetup(o: {
  modelsDir: string
  downloader: Downloader
  detect: () => Promise<Hardware>
  benchmark: () => Promise<number>
}): {
  status(): Promise<AiStatus>
  run(tier: Tier | undefined, onProgress: (p: AiProgress) => void): Promise<AiStatus>
} {
  const statePath = join(o.modelsDir, 'ai-state.json')

  async function status(): Promise<AiStatus> {
    const s = (await readFile(statePath, 'utf8')
      .then(JSON.parse)
      .catch(() => null)) as AiState | null
    const gguf = s && LLM_BY_TIER[s.tier]
    return {
      tier: gguf ? s.tier : null,
      hardware: s?.hardware ?? null,
      rtf: s?.rtf ?? null,
      ready: {
        stt: existsSync(sttModelFile(o.modelsDir)),
        pronunciation: pronunciationModelReady(o.modelsDir),
        llm: !!gguf && existsSync(join(o.modelsDir, gguf.file))
      },
      pronunciationEnabled: s?.pronunciationEnabled ?? false
    }
  }

  async function run(
    tier: Tier | undefined,
    onProgress: (p: AiProgress) => void
  ): Promise<AiStatus> {
    // One event per whole percent: a 5 GB download yields ~100 IPC messages, not one per chunk.
    const step = (phase: AiProgress['phase'], message: string): ((p: number) => void) => {
      let last = -1
      return (p) => {
        const percent = Math.floor(p)
        if (percent !== last) onProgress({ phase, percent: (last = percent), message })
      }
    }
    await mkdir(o.modelsDir, { recursive: true })
    configureModels(o.modelsDir, true)
    try {
      const hardware = await o.detect()

      const stt = step('stt', 'Baixando o reconhecimento de fala…')
      stt(0)
      await o.downloader.hf(STT_MODEL, stt)

      step('benchmark', 'Medindo a velocidade do computador…')(0)
      const rtf = await o.benchmark()

      const pron = pronunciationEnabled(rtf)
      if (pron) {
        const p = step('pronunciation', 'Baixando a avaliação de pronúncia…')
        p(0)
        await o.downloader.hf(PRON_MODEL, p)
      }

      const chosen = tier ?? chooseTier(hardware, rtf)
      const m = LLM_BY_TIER[chosen]
      const dest = join(o.modelsDir, m.file)
      const llm = step('llm', 'Baixando o modelo de linguagem…')
      llm(0)
      if (!existsSync(dest)) {
        const part = `${dest}.part`
        await o.downloader.gguf(m, part, llm)
        const { size } = await stat(part)
        if (Math.abs(size - m.bytes) > m.bytes * 0.01) {
          await rm(part, { force: true })
          throw new Error(`o arquivo do modelo veio com tamanho inesperado (${size} bytes)`)
        }
        await rename(part, dest)
      }

      const state: AiState = { tier: chosen, hardware, rtf, pronunciationEnabled: pron }
      await writeFile(`${statePath}.tmp`, JSON.stringify(state))
      await rename(`${statePath}.tmp`, statePath)

      // Only now that the new model is ready: drop other tiers' models and stale partial downloads.
      for (const t of Object.keys(LLM_BY_TIER) as Tier[]) {
        if (t === chosen) continue
        for (const f of [LLM_BY_TIER[t].file, `${LLM_BY_TIER[t].file}.part`]) {
          // a leftover file only wastes disk; the new state is already saved
          await rm(join(o.modelsDir, f), { force: true }).catch(() => {})
        }
      }
      onProgress({ phase: 'done', percent: 100, message: 'IA pronta.' })
    } catch (e) {
      onProgress({
        phase: 'error',
        percent: 0,
        message: `Falha ao preparar a IA: ${e instanceof Error ? e.message : String(e)}`
      })
    } finally {
      configureModels(o.modelsDir, false)
    }
    return status()
  }

  return { status, run }
}

type TotalProgress = { status: string; progress?: number }

/** Real downloads: transformers.js fills its own cache; GGUF is fetched with HTTP Range resume. */
export function createDownloader(): Downloader {
  return {
    async hf(repo, onPct) {
      const { cacheDir, allowRemote } = modelsConfig()
      const { env, pipeline, AutoModelForCTC, Wav2Vec2FeatureExtractor } =
        await import('@huggingface/transformers')
      env.cacheDir = cacheDir
      env.allowRemoteModels = allowRemote
      let pct = 0
      const progress_callback = (i: TotalProgress): void => {
        if (i.status === 'progress_total' && i.progress !== undefined) {
          onPct((pct = Math.max(pct, i.progress)))
        }
      }
      if (repo === PRON_MODEL) {
        const model = await AutoModelForCTC.from_pretrained(repo, {
          dtype: 'q8',
          progress_callback
        })
        await model.dispose()
        await Wav2Vec2FeatureExtractor.from_pretrained(repo, { progress_callback })
        await fetchVocab(cacheDir)
      } else {
        const p = await pipeline('automatic-speech-recognition', repo, {
          dtype: 'q8',
          progress_callback
        })
        await p.dispose()
      }
      onPct(100)
    },
    async gguf(m, dest, onPct) {
      const have = existsSync(dest) ? (await stat(dest)).size : 0
      const res = await fetch(`https://huggingface.co/${m.repo}/resolve/main/${m.file}`, {
        headers: have ? { Range: `bytes=${have}-` } : {}
      })
      if (res.status === 416) return // .part already complete; the caller checks its size
      if (!res.ok || !res.body) throw new Error(`download do modelo: HTTP ${res.status}`)
      const resumed = res.status === 206
      let done = resumed ? have : 0
      await pipeline(
        Readable.fromWeb(res.body as ReadableStream<Uint8Array>),
        async function* (src: AsyncIterable<Uint8Array>) {
          for await (const chunk of src) {
            done += chunk.length
            onPct(Math.min(100, (done / m.bytes) * 100))
            yield chunk
          }
        },
        createWriteStream(dest, { flags: resumed ? 'a' : 'w' })
      )
    }
  }
}
