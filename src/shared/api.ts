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
export type WordScore = { word: string; ok: boolean; expected: string; heard: string }
/** score 0..100; orientação apenas, não muda o veredito */
export type PronunciationResult = { score: number; words: WordScore[] }
export type TranscribeResult =
  | { ok: true; text: string; pronunciation?: PronunciationResult }
  | { ok: false; reason: 'no-model' | 'failed'; message: string }

export type FreeSpeakInput = { prompt_en: string; guidelines_pt: string[]; transcript: string }
export type FreeSpeakEval =
  | { ok: true; correct: boolean; feedback_pt: string; corrected_en: string }
  | { ok: false; reason: 'no-model' | 'failed' | 'timeout'; message: string }

export interface AppApi {
  loadCourse(): Promise<Course>
  loadState(): Promise<LoadResult>
  createProfile(name: string): Promise<Profile>
  saveProgress(progress: ProfileProgress): Promise<void>
  ensureMic(): Promise<boolean>
  transcribe(wav: Uint8Array, expected?: string): Promise<TranscribeResult>
  evaluateFreeSpeak(input: FreeSpeakInput): Promise<FreeSpeakEval>
  aiStatus(): Promise<AiStatus>
  setupAi(tier?: Tier): Promise<AiStatus>
  onAiProgress(cb: (p: AiProgress) => void): () => void
}

export type AiStatus = {
  tier: Tier | null
  hardware: Hardware | null
  /** chooseTier(hardware, rtf); null when the hardware could not be detected */
  recommended: Tier | null
  rtf: number | null
  ready: { stt: boolean; pronunciation: boolean; llm: boolean }
  pronunciationEnabled: boolean
}
export type AiProgress = {
  phase: 'stt' | 'pronunciation' | 'benchmark' | 'llm' | 'done' | 'error'
  percent: number
  message: string
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
