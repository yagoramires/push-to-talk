import type { Course } from './content'
import type { ProfileProgress } from './progress'

export type Profile = { id: string; name: string; createdAt: string }
export type AppState = {
  version: 1
  profiles: Profile[]
  progress: Record<string, ProfileProgress>
}
/** recoveredFrom: caminho do backup do arquivo corrompido */
export type LoadResult = { state: AppState; recoveredFrom?: string }
export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no-binary' | 'no-model' | 'failed'; message: string }

export interface AppApi {
  loadCourse(): Promise<Course>
  loadState(): Promise<LoadResult>
  createProfile(name: string): Promise<Profile>
  saveProgress(progress: ProfileProgress): Promise<void>
  ensureMic(): Promise<boolean>
  transcribe(wav: Uint8Array): Promise<TranscribeResult>
}

export type Tier = 'light' | 'medium' | 'strong'
export type Hardware = {
  platform: string
  arch: string
  totalMemGB: number
  cpuModel: string
  cores: number
  hasDiscreteGpu: boolean
}
