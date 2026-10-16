import { nextPosition, type Course, type Level, type Position } from './content'
import type { FinalVerdict } from './matcher'

export type Mode = 'solo' | 'guided'
export type ErrorEntry = {
  exerciseId: string
  unitId: string
  transcript: string
  at: string
  resolved: boolean
}
export type SessionRecord = {
  at: string
  mode: Mode
  minutes: number
  blocksDone: string[]
  errors: number
}
export type ProfileProgress = {
  profileId: string
  startLevel: Level
  position: Position | null
  completedBlocks: string[]
  errorLog: ErrorEntry[]
  sessions: SessionRecord[]
}

export function newProgress(profileId: string, startLevel: Level, course: Course): ProfileProgress {
  const unit = course.units.find((u) => u.level === startLevel)
  if (!unit) throw new Error(`Nível ${startLevel} não existe no curso`)
  return {
    profileId,
    startLevel,
    position: { unitId: unit.id, blockIndex: 0 },
    completedBlocks: [],
    errorLog: [],
    sessions: []
  }
}

export function recordAttempt(
  p: ProfileProgress,
  a: { exerciseId: string; unitId: string; transcript: string; verdict: FinalVerdict; at: string }
): ProfileProgress {
  const pending = (e: ErrorEntry): boolean => e.exerciseId === a.exerciseId && !e.resolved
  if (a.verdict === 'correct')
    return { ...p, errorLog: p.errorLog.map((e) => (pending(e) ? { ...e, resolved: true } : e)) }
  const entry: ErrorEntry = {
    exerciseId: a.exerciseId,
    unitId: a.unitId,
    transcript: a.transcript,
    at: a.at,
    resolved: false
  }
  return {
    ...p,
    errorLog: p.errorLog.some(pending)
      ? p.errorLog.map((e) => (pending(e) ? entry : e))
      : [...p.errorLog, entry]
  }
}

export function completeBlock(p: ProfileProgress, course: Course, blockId: string): ProfileProgress {
  const current = p.position
    ? course.units.find((u) => u.id === p.position!.unitId)?.blocks[p.position.blockIndex]
    : undefined
  return {
    ...p,
    completedBlocks: p.completedBlocks.includes(blockId) ? p.completedBlocks : [...p.completedBlocks, blockId],
    position: current?.id === blockId ? nextPosition(course, p.position!) : p.position
  }
}

export function recordSession(p: ProfileProgress, r: SessionRecord): ProfileProgress {
  return { ...p, sessions: [...p.sessions, r] }
}

export function soloSinceLastGuided(p: ProfileProgress): {
  sessions: SessionRecord[]
  blocksDone: string[]
  openErrors: ErrorEntry[]
} {
  const lastGuided = p.sessions.map((s) => s.mode).lastIndexOf('guided')
  const sessions = p.sessions.slice(lastGuided + 1)
  return {
    sessions,
    blocksDone: [...new Set(sessions.flatMap((s) => s.blocksDone))],
    openErrors: p.errorLog.filter((e) => !e.resolved)
  }
}
