import { examDue } from './assessment'
import {
  LEVELS,
  nextPosition,
  type Block,
  type Course,
  type FreeSpeak,
  type Level,
  type Position
} from './content'
import type { ProfileProgress } from './progress'

export const DURATIONS = [10, 20, 30, 40, 50, 60] as const
export type Duration = (typeof DURATIONS)[number]
export type SessionStep =
  | { kind: 'review'; minutes: number; exerciseIds: string[] }
  | { kind: 'block'; minutes: number; unitId: string; block: Block }
  | { kind: 'wrapup'; minutes: number; unitId: string; exercise: FreeSpeak }
export type SessionPlan = { steps: SessionStep[]; courseComplete: boolean; examDue: Level | null }

export function buildSession(course: Course, p: ProfileProgress, minutes: Duration): SessionPlan {
  const open = p.errorLog.filter((e) => !e.resolved).slice(0, 5)
  const reviewMin = open.length ? Math.min(5, Math.max(2, Math.round(minutes * 0.15))) : 0
  const convMin = minutes <= 10 ? 2 : 4
  const budget = minutes - reviewMin - convMin

  const steps: SessionStep[] = open.length
    ? [{ kind: 'review', minutes: reviewMin, exerciseIds: open.map((e) => e.exerciseId) }]
    : []
  const blocks: Extract<SessionStep, { kind: 'block' }>[] = []
  let sum = 0
  /** Adds the block if it fits the budget (the first one always does); false when it does not. */
  const add = (unitId: string, block: Block): boolean => {
    if (blocks.length && sum + block.minutes > budget + 1) return false
    blocks.push({ kind: 'block', minutes: block.minutes, unitId, block })
    sum += block.minutes
    return true
  }

  const due = examDue(p, course)
  let pos: Position | null = p.position
  if (due) {
    // Prova pendente: reforço das unidades fracas (ou da última do nível), sem avançar a trilha.
    const weak = p.weakUnits.length
      ? p.weakUnits
      : course.units
          .filter((u) => u.level === p.level)
          .slice(-1)
          .map((u) => u.id)
    const queue = course.units
      .filter((u) => weak.includes(u.id))
      .flatMap((u) => u.blocks.map((block) => ({ unitId: u.id, block })))
    for (const { unitId, block } of queue) if (!add(unitId, block)) break
  } else {
    // Sem prova do nível atual no curso, a trilha não trava.
    const gate = course.exams?.[p.level] ? LEVELS.indexOf(p.level) : LEVELS.length
    while (pos) {
      const unit = course.units.find((u) => u.id === pos!.unitId)
      const block = unit?.blocks[pos.blockIndex]
      if (!unit || !block || LEVELS.indexOf(unit.level) > gate || !add(unit.id, block)) break
      pos = nextPosition(course, pos)
    }
  }
  steps.push(...blocks)

  const last = blocks.at(-1)
  const free = last
    ? course.units
        .find((u) => u.id === last.unitId)
        ?.blocks.find((b) => b.kind === 'conversation')
        ?.exercises.find((e): e is FreeSpeak => e.kind === 'free_speak')
    : undefined
  if (last && free)
    steps.push({ kind: 'wrapup', minutes: convMin, unitId: last.unitId, exercise: free })

  return { steps, courseComplete: !due && pos === null, examDue: due }
}
