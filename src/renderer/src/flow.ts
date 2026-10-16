import {
  findExercise,
  type BlockKind,
  type CommonError,
  type Course,
  type Exercise,
  type Position,
  type VocabCard
} from '../../shared/content'
import type { SessionPlan } from '../../shared/session'

export const BLOCK_LABELS: Record<BlockKind, string> = {
  warmup: 'Aquecimento',
  vocabulary: 'Vocabulário',
  pronunciation: 'Pronúncia',
  listening: 'Listening',
  conversation: 'Conversação',
  review: 'Revisão'
}

export type SessionItem = {
  exercise: Exercise
  unitId: string
  label: string
  /** Set on the last exercise of a block: answering it completes the block. */
  completesBlockId?: string
}

/** Flattens the plan into the exercises to run, in order. Review ids not found in the course are skipped. */
export function flattenPlan(course: Course, plan: SessionPlan): SessionItem[] {
  return plan.steps.flatMap((step): SessionItem[] => {
    if (step.kind === 'review')
      return step.exerciseIds.flatMap((id) => {
        const found = findExercise(course, id)
        return found
          ? [{ exercise: found.exercise, unitId: found.unit.id, label: 'Revisão dos erros' }]
          : []
      })
    if (step.kind === 'wrapup')
      return [{ exercise: step.exercise, unitId: step.unitId, label: 'Conversa final' }]
    const last = step.block.exercises.length - 1
    return step.block.exercises.map((exercise, i) => ({
      exercise,
      unitId: step.unitId,
      label: BLOCK_LABELS[step.block.kind],
      ...(i === last ? { completesBlockId: step.block.id } : {})
    }))
  })
}

/** Fisher–Yates copy; avoids returning the original order when another order exists. */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const distinct = new Set(items).size > 1
  for (let attempt = 0; attempt < 10; attempt++) {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    if (!distinct || out.some((x, i) => x !== items[i])) return out
  }
  return [...items].reverse()
}

/** A vocab card is checked like a `repeat` of its example sentence. */
export function vocabAsRepeat(card: VocabCard): {
  accepted: string[]
  commonErrors: CommonError[]
} {
  return { accepted: [card.example_en], commonErrors: [] }
}

/** Seconds → "m:ss" (negative values get a "+" since time is over). */
export function formatClock(seconds: number): string {
  const r = Math.round(seconds)
  const s = Math.abs(r)
  const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return r < 0 ? `+${text}` : text
}

/** "Aquecimento · Cumprimentos (A1)" for a track position; null = end of course. */
export function describePosition(course: Course, pos: Position | null): string | null {
  if (!pos) return null
  const unit = course.units.find((u) => u.id === pos.unitId)
  const block = unit?.blocks[pos.blockIndex]
  return unit && block ? `${BLOCK_LABELS[block.kind]} · ${unit.title_pt} (${unit.level})` : null
}
