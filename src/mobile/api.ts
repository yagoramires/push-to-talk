import type { AiStatus, AppApi, AppState } from '../shared/api'
import type { ProfileProgress } from '../shared/progress'
import { parseCourse } from '../shared/course-source'
import { Share } from '@capacitor/share'
import { createCapacitorFs, type TextFs } from './fs'
import { createMobileSamples } from './samples'
import { createMobileStore } from './store'

type Deps = {
  fs: TextFs
  fetch: typeof fetch
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
}

const noAi: AiStatus = {
  tier: null,
  hardware: null,
  recommended: null,
  rtf: null,
  ready: { stt: false, pronunciation: false, llm: false },
  pronunciationEnabled: false
}

// Task 6 fills in speech and AI; for now those are empty answers.
export function createMobileApi(deps: Partial<Deps> = {}): AppApi {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const fs = deps.fs ?? createCapacitorFs()
  const store = createMobileStore(fs)
  const samples = createMobileSamples(fs)
  let state: AppState | null = null
  const current = async (): Promise<AppState> => (state ??= (await store.load()).state)
  const getUserMedia = deps.getUserMedia ?? ((c) => navigator.mediaDevices.getUserMedia(c))

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
    transcribe: async () => ({ ok: false, reason: 'no-model', message: 'IA ainda não preparada' }),
    evaluateFreeSpeak: async () => ({
      ok: false,
      reason: 'no-model',
      message: 'IA ainda não preparada'
    }),
    aiStatus: async () => noAi,
    setupAi: async () => noAi,
    onAiProgress: () => () => {},
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
