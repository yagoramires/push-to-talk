import type { PronunciationResult } from '../shared/api'

export type AiRequest =
  | { type: 'has'; repo: string }
  | { type: 'download'; repo: string }
  | { type: 'transcribe'; samples: Float32Array; prompt?: string }
  | { type: 'score'; samples: Float32Array; expected: string }
  | { type: 'benchmark'; samples: Float32Array; sampleRate: number }
  | { type: 'dispose' }

type Reply = {
  id: number
  value?: unknown
  error?: string
  progress?: number
  log?: { level: 'info' | 'warn' | 'error'; args: string[] }
}

export type AiClient = {
  has(repo: string): Promise<boolean>
  download(repo: string, onPct: (p: number) => void): Promise<void>
  transcribe(samples: Float32Array, prompt?: string): Promise<string>
  score(samples: Float32Array, expected: string): Promise<PronunciationResult | null>
  benchmark(samples: Float32Array, sampleRate: number): Promise<number>
  dispose(): Promise<void>
}

/** Minimal RPC over postMessage (id → promise); the worker is started on first use. */
export function createAiClient(): AiClient {
  let worker: Worker | null = null
  let next = 0
  const pending = new Map<
    number,
    { resolve(v: unknown): void; reject(e: Error): void; progress?: (p: number) => void }
  >()

  function call<T>(req: AiRequest, progress?: (p: number) => void): Promise<T> {
    if (!worker) {
      worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<Reply>) => {
        // console here is copied to main.log by initMobileLog
        if (e.data.log) return console[e.data.log.level]('worker', ...e.data.log.args)
        const p = pending.get(e.data.id)
        if (!p) return
        if (e.data.progress !== undefined) return p.progress?.(e.data.progress)
        pending.delete(e.data.id)
        if (e.data.error !== undefined) p.reject(new Error(e.data.error))
        else p.resolve(e.data.value)
      }
      worker.onerror = (e) => {
        // A crashed worker fails every call; the next call starts a fresh one.
        for (const p of pending.values()) p.reject(new Error(e.message || 'ai worker crashed'))
        pending.clear()
        worker?.terminate()
        worker = null
      }
    }
    const id = next++
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress })
      worker!.postMessage({ ...req, id })
    })
  }

  return {
    has: (repo) => call({ type: 'has', repo }),
    download: (repo, onPct) => call({ type: 'download', repo }, onPct),
    transcribe: (samples, prompt) => call({ type: 'transcribe', samples, prompt }),
    score: (samples, expected) => call({ type: 'score', samples, expected }),
    benchmark: (samples, sampleRate) => call({ type: 'benchmark', samples, sampleRate }),
    dispose: () => call({ type: 'dispose' })
  }
}
