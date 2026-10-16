import { randomUUID } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, ipcMain, shell, systemPreferences } from 'electron'
import type { AiStatus, AppApi, AppState, Sample, Tier } from '../shared/api'
import type { ProfileProgress } from '../shared/progress'
import { decodeWav } from '../shared/wav'
import { loadCourse } from './content/load-course'
import { configureModels, createTranscriber } from './ai/stt'
import { createPronunciationScorer } from './ai/pronunciation'
import { createFreeSpeakEvaluator } from './ai/freeSpeak'
import { detectHardware } from './ai/hardware'
import { createAiSetup, createDownloader } from './ai/setup'
import { LLM_BY_TIER, STT_BY_TIER } from './ai/tiers'
import { resourcePaths } from './self-check'
import { createSamples } from './samples'
import { createStore } from './store'

export function registerIpc(logPath: string): void {
  const store = createStore(app.getPath('userData'))
  const samples = createSamples(app.getPath('userData'))
  const { content: contentDir, benchmarkWav } = resourcePaths({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  })
  const modelsDir = join(app.getPath('userData'), 'models')
  configureModels(modelsDir, false)
  const transcriber = createTranscriber()
  const pronunciation = createPronunciationScorer()
  const setup = createAiSetup({
    modelsDir,
    downloader: createDownloader(),
    detect: detectHardware,
    /** rtf = whisper time on the clip ÷ clip duration, after a warm-up run that loads the model */
    async benchmark() {
      const { samples, sampleRate } = decodeWav(new Uint8Array(await readFile(benchmarkWav)))
      const time = async (): Promise<number> => {
        const t0 = performance.now()
        const r = await transcriber.transcribe(samples)
        if (!r.ok) throw new Error(r.message)
        return (performance.now() - t0) / 1000
      }
      await time()
      return (await time()) / (samples.length / sampleRate)
    }
  })
  let aiStatus: Promise<AiStatus> = setup.status()
  let setupRun: Promise<AiStatus> | null = null
  let freeSpeak: { path: string; ev: ReturnType<typeof createFreeSpeakEvaluator> } | null = null
  let state: AppState | null = null
  const current = async (): Promise<AppState> => (state ??= (await store.load()).state)

  const handlers: Omit<AppApi, 'setupAi' | 'onAiProgress'> = {
    loadCourse: () => loadCourse(contentDir),
    async loadState() {
      const r = await store.load()
      state = r.state
      return r
    },
    async createProfile(name: string) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome do perfil não pode ser vazio')
      const s = await current()
      const profile = { id: randomUUID(), name: trimmed, createdAt: new Date().toISOString() }
      s.profiles.push(profile)
      await store.save(s)
      return profile
    },
    async saveProgress(progress: ProfileProgress) {
      const s = await current()
      if (!s.profiles.some((p) => p.id === progress.profileId)) {
        throw new Error(`Perfil desconhecido: ${progress.profileId}`)
      }
      s.progress[progress.profileId] = progress
      await store.save(s)
    },
    async ensureMic() {
      return process.platform === 'darwin'
        ? systemPreferences.askForMediaAccess('microphone')
        : true
    },
    async transcribe(wav: Uint8Array, expected?: string, hint?: string) {
      let samples: Float32Array
      try {
        samples = decodeWav(wav).samples
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
      const { tier, pronunciationEnabled } = await aiStatus
      // A biased transcript cannot hide mispronunciations: pronunciation is scored from the audio below.
      const r = await transcriber.transcribe(samples, {
        model: tier ? STT_BY_TIER[tier] : undefined,
        prompt: expected?.trim() || hint
      })
      if (!r.ok || !expected?.trim() || !pronunciationEnabled) return r
      try {
        const p = await pronunciation.score(samples, expected)
        return p ? { ...r, pronunciation: p } : r
      } catch (e) {
        console.warn('pronunciation failed', e) // guidance only: never fails the transcription
        return r
      }
    },
    async evaluateFreeSpeak(input) {
      const { tier } = await aiStatus
      if (!tier) return { ok: false, reason: 'no-model', message: 'A IA ainda não foi preparada.' }
      const path = join(modelsDir, LLM_BY_TIER[tier].file)
      if (freeSpeak?.path !== path) {
        void freeSpeak?.ev.dispose()
        freeSpeak = { path, ev: createFreeSpeakEvaluator(path) }
      }
      return freeSpeak.ev.evaluate(input)
    },
    aiStatus: () => (aiStatus = setup.status()),
    async openLogs() {
      shell.showItemInFolder(logPath)
    },
    getSettings: () => samples.getSettings(),
    setSaveSamples: (on: boolean) => samples.setSaveSamples(on),
    saveSample: (sample: Sample) => samples.save(sample),
    async openSamples() {
      await mkdir(samples.dir, { recursive: true })
      const err = await shell.openPath(samples.dir)
      if (err) throw new Error(err)
    },
    deleteSamples: () => samples.remove()
  }

  for (const name of Object.keys(handlers) as (keyof typeof handlers)[]) {
    // Logs name, time and outcome only: arguments carry what the person said.
    ipcMain.handle(name, async (_event, ...args: unknown[]) => {
      const t0 = performance.now()
      try {
        const r = await (handlers[name] as (...a: unknown[]) => unknown)(...args)
        const fail = r && typeof r === 'object' && 'ok' in r && r.ok === false
        console.info(`ipc ${name} ${Math.round(performance.now() - t0)} ms`, fail ? r : '')
        return r
      } catch (e) {
        console.error(`ipc ${name} threw after ${Math.round(performance.now() - t0)} ms`, e)
        throw e
      }
    })
  }

  // Separate from the generic loop: progress goes back to the window that asked.
  ipcMain.handle(
    'setupAi',
    (e, tier?: Tier) =>
      (setupRun ??= (async () => {
        // Release the loaded GGUF first: switching tiers deletes the old file (locked on Windows).
        await freeSpeak?.ev.dispose()
        freeSpeak = null
        await transcriber.dispose() // the benchmark needs base; a tier switch may delete small

        console.info('setupAi start', tier ?? 'auto')
        let phase = ''
        const s = await setup.run(tier, (p) => {
          if (p.phase !== phase) console.info('setupAi phase', (phase = p.phase), p.message)
          if (!e.sender.isDestroyed()) e.sender.send('ai-progress', p)
        })
        aiStatus = Promise.resolve(s)
        return s
      })().finally(() => (setupRun = null)))
  )
}
