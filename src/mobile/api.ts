import type { AiStatus, AppApi } from '../shared/api'
import { parseCourse } from '../shared/course-source'
import { emptyState } from '../shared/state'
import type { TextFs } from './fs'

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

// Tasks 5 and 6 fill in state, speech and AI; for now those are empty answers.
export function createMobileApi(deps: Partial<Deps> = {}): AppApi {
  const doFetch = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
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
    loadState: async () => ({ state: emptyState() }),
    createProfile: async (name) => ({
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString()
    }),
    saveProgress: async () => {},
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
    openLogs: async () => {},
    getSettings: async () => ({ saveSamples: false }),
    setSaveSamples: async () => {},
    saveSample: async () => {},
    openSamples: async () => {},
    deleteSamples: async () => {}
  }
}
