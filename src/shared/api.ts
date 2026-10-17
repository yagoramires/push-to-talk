import type { Course } from './content'
import type { FinalVerdict } from './matcher'
import type { Mode, ProfileProgress } from './progress'

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
  readonly platform: 'desktop' | 'android'
  /** Playable URL of a course mp3; desktop: `course-audio://audio/<file>` */
  audioUrl(file: string): string
  loadCourse(): Promise<Course>
  loadState(): Promise<LoadResult>
  createProfile(name: string): Promise<Profile>
  saveProgress(progress: ProfileProgress): Promise<void>
  ensureMic(): Promise<boolean>
  /** expected: prompt + pronunciation scoring; hint: prompt only (used when expected is absent). */
  transcribe(wav: Uint8Array, expected?: string, hint?: string): Promise<TranscribeResult>
  evaluateFreeSpeak(input: FreeSpeakInput): Promise<FreeSpeakEval>
  aiStatus(): Promise<AiStatus>
  setupAi(tier?: Tier): Promise<AiStatus>
  onAiProgress(cb: (p: AiProgress) => void): () => void
  /** Shows main.log in Finder/Explorer, to send back when something goes wrong. */
  openLogs(): Promise<void>
  getSettings(): Promise<Settings>
  setSaveSamples(on: boolean): Promise<void>
  /** Kept only when settings.saveSamples is on (checked in main); otherwise a no-op. */
  saveSample(sample: Sample): Promise<void>
  openSamples(): Promise<void>
  deleteSamples(): Promise<void>
}

export type Settings = { saveSamples: boolean }
/** One spoken answer with its final verdict, saved to improve recognition. */
export type Sample = {
  exerciseId: string
  mode: Mode
  wav: Uint8Array
  expected?: string
  hint?: string
  transcript: string
  verdict: FinalVerdict
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
