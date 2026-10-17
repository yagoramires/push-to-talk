import type { AiProgress, AiStatus, AppApi, AppState } from '../shared/api'
import type { ProfileProgress } from '../shared/progress'
import { parseCourse } from '../shared/course-source'
import { toGB } from '../shared/models'
import { decodeWav } from '../shared/wav'
import { Share } from '@capacitor/share'
import { FileTransfer } from '@capacitor/file-transfer'
import { createAiClient, type AiClient } from './ai-client'
import { createCapacitorFs, type TextFs } from './fs'
import { Llama, createMobileFreeSpeak, createNativeLlm, type NativeLlm } from './llm-native'
import { createMobileSamples } from './samples'
import { createMobileSetup, type MobileSetupDeps } from './setup'
import { createMobileStore } from './store'

type Deps = {
  fs: TextFs
  fetch: typeof fetch
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
  ai: AiClient
  llm: NativeLlm
  detect: MobileSetupDeps['detect']
  gguf: MobileSetupDeps['gguf']
}

export function createMobileApi(deps: Partial<Deps> = {}): AppApi {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const fs = deps.fs ?? createCapacitorFs()
  const store = createMobileStore(fs)
  const samples = createMobileSamples(fs)
  let state: AppState | null = null
  const current = async (): Promise<AppState> => (state ??= (await store.load()).state)
  const getUserMedia = deps.getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c))

  const ai = deps.ai ?? createAiClient()
  const setup = createMobileSetup({
    fs,
    models: {
      has: ai.has,
      download: ai.download,
      async benchmark() {
        const wav = new Uint8Array(await (await doFetch('benchmark.wav')).arrayBuffer())
        const { samples, sampleRate } = decodeWav(wav)
        return ai.benchmark(samples, sampleRate)
      }
    },
    gguf: deps.gguf ?? downloadGguf(fs),
    detect:
      deps.detect ??
      (async () => {
        const d = await Llama.deviceInfo()
        return {
          platform: 'android',
          arch: 'arm64',
          totalMemGB: toGB(d.totalRam),
          cores: d.cores,
          cpuModel: d.cpuModel,
          hasDiscreteGpu: false
        }
      }),
    persist: () => navigator.storage.persist()
  })
  const freeSpeak = createMobileFreeSpeak(deps.llm ?? createNativeLlm(), setup.modelPath)
  let aiStatus: Promise<AiStatus> | null = null
  const status = (): Promise<AiStatus> => (aiStatus ??= setup.status())
  let setupRun: Promise<AiStatus> | null = null
  const listeners = new Set<(p: AiProgress) => void>()

  return {
    platform: 'android',
    audioUrl: (file) => 'content/audio/' + file,
    async loadCourse() {
      return parseCourse({
        async unitFiles() {
          return (await doFetch('content/units/index.json')).json()
        },
        async read(path) {
          const res = await doFetch('content/' + path)
          return res.ok ? res.text() : undefined
        }
      })
    },
    async loadState() {
      const r = await store.load()
      state = r.state
      return r
    },
    async createProfile(name) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Nome do perfil não pode ser vazio')
      const s = await current()
      const profile = {
        id: crypto.randomUUID(),
        name: trimmed,
        createdAt: new Date().toISOString()
      }
      s.profiles.push(profile)
      await store.save(s)
      return profile
    },
    async saveProgress(progress: ProfileProgress) {
      const s = await current()
      if (!s.profiles.some((p) => p.id === progress.profileId))
        throw new Error(`Perfil desconhecido: ${progress.profileId}`)
      s.progress[progress.profileId] = progress
      await store.save(s)
    },
    async ensureMic() {
      try {
        const stream = await getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        return true
      } catch {
        return false
      }
    },
    async transcribe(wav, expected, hint) {
      let samples: Float32Array
      try {
        samples = decodeWav(wav).samples
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
      const { ready, pronunciationEnabled } = await status()
      if (!ready.stt)
        return { ok: false, reason: 'no-model', message: 'A IA ainda não foi preparada.' }
      let text: string
      try {
        // A biased transcript cannot hide mispronunciations: pronunciation is scored from the audio below.
        text = await ai.transcribe(samples, expected?.trim() || hint)
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
      if (!expected?.trim() || !pronunciationEnabled || !ready.pronunciation)
        return { ok: true, text }
      try {
        const p = await ai.score(samples, expected)
        return p ? { ok: true, text, pronunciation: p } : { ok: true, text }
      } catch (e) {
        console.warn('pronunciation failed', e) // guidance only: never fails the transcription
        return { ok: true, text }
      }
    },
    evaluateFreeSpeak: (input) => freeSpeak.evaluate(input),
    aiStatus: () => (aiStatus = setup.status()),
    // One package on Android: the tier argument is ignored.
    setupAi: () =>
      (setupRun ??= (async () => {
        console.info('setupAi start')
        let phase = ''
        const s = await setup.run((p) => {
          if (p.phase !== phase) console.info('setupAi phase', (phase = p.phase), p.message)
          listeners.forEach((l) => l(p))
        })
        aiStatus = Promise.resolve(s)
        return s
      })().finally(() => (setupRun = null))),
    onAiProgress(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async openLogs() {
      if ((await fs.size('logs/main.log')) === undefined) return
      await Share.share({ files: [await fs.uri('logs/main.log')] })
    },
    getSettings: samples.getSettings,
    setSaveSamples: samples.setSaveSamples,
    saveSample: samples.save,
    openSamples: async () => {},
    deleteSamples: samples.remove
  }
}

/** Native download straight to Directory.Data: 1.3 GB never crosses the JS bridge. */
// shortcut: no resume (the desktop resumes with Range); a dropped download restarts from zero.
function downloadGguf(fs: TextFs): MobileSetupDeps['gguf'] {
  return async (m, path, onPct) => {
    await fs.remove(path)
    await fs.write(path, '') // creates models/
    const sub = await FileTransfer.addListener('progress', (p) =>
      onPct(Math.min(100, (p.bytes / m.bytes) * 100))
    )
    try {
      await FileTransfer.downloadFile({
        url: `https://huggingface.co/${m.repo}/resolve/main/${m.file}`,
        path: await fs.uri(path),
        progress: true
      })
    } finally {
      await sub.remove()
    }
  }
}
