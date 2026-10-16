import {
  findExercise,
  LEVELS,
  SKILLS,
  type Level,
  type Skill,
  type Block,
  type BlockKind,
  type CommonError,
  type Course,
  type Exercise,
  type Position,
  type VocabCard
} from '../../shared/content'
import type { Hardware, Tier } from '../../shared/api'
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
  /** Position of the plan step this exercise belongs to, and that step's minutes (for the phase timer). */
  stepIndex: number
  stepMinutes: number
  /** The block holding the exercise, for the teacher's notes. */
  block?: Block
}

/**
 * Flattens the plan into the exercises to run, in order. Review ids not found in the course are skipped,
 * and the wrapup is dropped when its exercise is already in one of the session's blocks.
 */
export function flattenPlan(course: Course, plan: SessionPlan): SessionItem[] {
  const inBlocks = new Set(
    plan.steps.flatMap((s) => (s.kind === 'block' ? s.block.exercises.map((e) => e.id) : []))
  )
  return plan.steps.flatMap((step, stepIndex): SessionItem[] => {
    const at = { stepIndex, stepMinutes: step.minutes }
    if (step.kind === 'review')
      return step.exerciseIds.flatMap((id) => {
        const found = findExercise(course, id)
        return found
          ? [
              {
                exercise: found.exercise,
                unitId: found.unit.id,
                label: 'Revisão dos erros',
                block: found.block,
                ...at
              }
            ]
          : []
      })
    if (step.kind === 'wrapup')
      return inBlocks.has(step.exercise.id)
        ? []
        : [
            {
              exercise: step.exercise,
              unitId: step.unitId,
              label: 'Conversa final',
              block: findExercise(course, step.exercise.id)?.block,
              ...at
            }
          ]
    const last = step.block.exercises.length - 1
    return step.block.exercises.map((exercise, i) => ({
      exercise,
      unitId: step.unitId,
      label: BLOCK_LABELS[step.block.kind],
      block: step.block,
      ...at,
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

export const TIERS: Tier[] = ['light', 'medium', 'strong']
export const TIER_LABELS: Record<Tier, string> = { light: 'Leve', medium: 'Médio', strong: 'Forte' }

/** Detected hardware as short Portuguese lines for the setup screen. */
export function describeHardware(hw: Hardware): string[] {
  return [
    `Processador: ${hw.cpuModel} (${hw.cores} núcleos)`,
    `Memória: ${hw.totalMemGB} GB de RAM`,
    `Placa de vídeo dedicada: ${hw.hasDiscreteGpu ? 'sim' : 'não'}`
  ]
}

/** Decimal units, like the sizes Hugging Face shows: "1,7 GB", "395 MB". */
export function formatSize(bytes: number): string {
  const gb = bytes / 1e9
  return gb >= 1
    ? `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${Math.round(bytes / 1e6)} MB`
}

export const SKILL_LABELS: Record<Skill, string> = {
  listening: 'Listening',
  speaking: 'Fala',
  vocabulary: 'Vocabulário',
  structure: 'Estrutura de frases'
}

/** The highest available level not above the result (the course may not have the result's units yet). */
export function placementStartLevel(result: Level, available: Level[]): Level {
  const fit = available.filter((l) => LEVELS.indexOf(l) <= LEVELS.indexOf(result))
  return fit.at(-1) ?? available[0]
}

/** Correct/total per skill, in SKILLS order, skipping skills with no answers. */
export function skillSummary(
  answers: { skill: Skill; correct: boolean }[]
): { skill: Skill; correct: number; total: number }[] {
  return SKILLS.map((skill) => {
    const rs = answers.filter((a) => a.skill === skill)
    return { skill, correct: rs.filter((a) => a.correct).length, total: rs.length }
  }).filter((s) => s.total > 0)
}
