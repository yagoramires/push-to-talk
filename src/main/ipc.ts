import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app, ipcMain, systemPreferences } from 'electron'
import type { AppApi, AppState } from '../shared/api'
import type { ProfileProgress } from '../shared/progress'
import { decodeWav } from '../shared/wav'
import { loadCourse } from './content/load-course'
import { configureModels, createTranscriber } from './ai/stt'
import { createStore } from './store'

export function registerIpc(): void {
  const store = createStore(app.getPath('userData'))
  const contentDir = app.isPackaged
    ? join(process.resourcesPath, 'content')
    : join(app.getAppPath(), 'content')
  // shortcut: no download yet (Task 5); dev users pre-populate via INGLES_DOWNLOAD_MODELS=1 npm test.
  configureModels(join(app.getPath('userData'), 'models'), false)
  const transcriber = createTranscriber()
  let state: AppState | null = null
  const current = async (): Promise<AppState> => (state ??= (await store.load()).state)

  const handlers: AppApi = {
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
    async transcribe(wav: Uint8Array) {
      try {
        return await transcriber.transcribe(decodeWav(wav).samples)
      } catch (e) {
        return { ok: false, reason: 'failed', message: String(e) }
      }
    }
  }

  for (const name of Object.keys(handlers) as (keyof AppApi)[]) {
    ipcMain.handle(name, (_event, ...args: unknown[]) =>
      (handlers[name] as (...a: unknown[]) => unknown)(...args)
    )
  }
}
