import {
  LEVELS,
  SKILLS,
  type AssessmentItem,
  type Course,
  type Level,
  type LevelExam,
  type Placement,
  type Skill
} from './content'
import { recordAttempt, type ExamRecord, type Mode, type ProfileProgress } from './progress'

export const PASS_TOTAL = 0.7
export const PASS_EACH = 0.5

/** Passa com acertos >= PASS_TOTAL no total e >= PASS_EACH em cada habilidade presente. */
export function passes(results: { skill: Skill; correct: boolean }[]): {
  passed: boolean
  scores: Partial<Record<Skill, number>>
  total: number
} {
  const rate = (rs: typeof results): number => rs.filter((r) => r.correct).length / rs.length
  const scores: Partial<Record<Skill, number>> = {}
  for (const skill of SKILLS) {
    const rs = results.filter((r) => r.skill === skill)
    if (rs.length) scores[skill] = rate(rs)
  }
  const total = results.length ? rate(results) : 0
  const passed = total >= PASS_TOTAL && Object.values(scores).every((s) => s >= PASS_EACH)
  return { passed, scores, total }
}

const lastUnitOf = (course: Course, level: Level): string | undefined =>
  course.units.filter((u) => u.level === level).at(-1)?.id

/**
 * Nível cuja prova está pendente: a posição saiu do nível atual (unidade de nível acima, ou fim da trilha)
 * e a prova desse nível existe e ainda não foi aprovada.
 */
export function examDue(p: ProfileProgress, course: Course): Level | null {
  if (p.courseComplete || !course.exams?.[p.level]) return null
  const unit = p.position && course.units.find((u) => u.id === p.position!.unitId)
  const left = !p.position || (!!unit && LEVELS.indexOf(unit.level) > LEVELS.indexOf(p.level))
  if (!left || p.exams.some((e) => e.level === p.level && e.passed)) return null
  return p.level
}

export function applyExamResult(
  p: ProfileProgress,
  course: Course,
  exam: LevelExam,
  answers: {
    exerciseId: string
    skill: Skill
    unitId?: string
    correct: boolean
    transcript: string
  }[],
  at: string,
  mode: Mode
): { progress: ProfileProgress; record: ExamRecord } {
  const { passed, scores, total } = passes(answers)
  // A prova tem as 4 partes (LevelExamSchema), então todas as habilidades têm nota.
  const record: ExamRecord = {
    level: exam.level,
    at,
    mode,
    scores: scores as Record<Skill, number>,
    total,
    passed
  }
  const lastUnit = lastUnitOf(course, exam.level)
  const unitOf = (a: (typeof answers)[number]): string | undefined => a.unitId ?? lastUnit

  let progress = answers.reduce(
    (acc, a) =>
      recordAttempt(acc, {
        exerciseId: a.exerciseId,
        unitId: unitOf(a) ?? '',
        transcript: a.transcript,
        verdict: a.correct ? 'correct' : 'error',
        at
      }),
    p
  )
  progress = { ...progress, exams: [...progress.exams, record] }
  if (passed) {
    const next = LEVELS[LEVELS.indexOf(exam.level) + 1]
    progress = { ...progress, level: next ?? exam.level, courseComplete: !next, weakUnits: [] }
  } else {
    const weak = answers.filter((a) => !a.correct).map(unitOf)
    progress = { ...progress, weakUnits: [...new Set(weak)].filter((u): u is string => !!u) }
  }
  return { progress, record }
}

export type PlacementState = {
  levelIndex: number
  answers: { level: Level; skill: Skill; correct: boolean }[]
  done: boolean
  result: Level | null
}

/** Começa no A1 e sobe enquanto a pessoa passa; o resultado é o primeiro nível não aprovado (no máximo C1). */
export function startPlacement(): PlacementState {
  return { levelIndex: 0, answers: [], done: false, result: null }
}

/** Os itens do nível atual; PlacementSchema garante os níveis na ordem de LEVELS. */
export function currentPlacementItems(placement: Placement, s: PlacementState): AssessmentItem[] {
  return placement.levels[s.levelIndex].items
}

export function finishPlacementLevel(
  s: PlacementState,
  answers: { skill: Skill; correct: boolean }[]
): PlacementState {
  const level = LEVELS[s.levelIndex]
  const all = [...s.answers, ...answers.map((a) => ({ level, ...a }))]
  const last = s.levelIndex === LEVELS.length - 1
  if (passes(answers).passed && !last)
    return { levelIndex: s.levelIndex + 1, answers: all, done: false, result: null }
  return { levelIndex: s.levelIndex, answers: all, done: true, result: level }
}
