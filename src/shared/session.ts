import { nextPosition, type Block, type Course, type FreeSpeak, type Position } from './content'
import type { ProfileProgress } from './progress'

export const DURATIONS = [10, 20, 30, 40, 50, 60] as const
export type Duration = (typeof DURATIONS)[number]
export type SessionStep =
  | { kind: 'review'; minutes: number; exerciseIds: string[] }
  | { kind: 'block'; minutes: number; unitId: string; block: Block }
  | { kind: 'wrapup'; minutes: number; unitId: string; exercise: FreeSpeak }
export type SessionPlan = { steps: SessionStep[]; courseComplete: boolean }

export function buildSession(course: Course, p: ProfileProgress, minutes: Duration): SessionPlan {
  const open = p.errorLog.filter((e) => !e.resolved).slice(0, 5)
  const reviewMin = open.length ? Math.min(5, Math.max(2, Math.round(minutes * 0.15))) : 0
  const convMin = minutes <= 10 ? 2 : 4
  const budget = minutes - reviewMin - convMin

  const steps: SessionStep[] = open.length
    ? [{ kind: 'review', minutes: reviewMin, exerciseIds: open.map((e) => e.exerciseId) }]
    : []
  const blocks: Extract<SessionStep, { kind: 'block' }>[] = []
  let pos: Position | null = p.position
  let sum = 0
  while (pos) {
    const unit = course.units.find((u) => u.id === pos!.unitId)
    const block = unit?.blocks[pos.blockIndex]
    if (!unit || !block) break
    if (blocks.length && sum + block.minutes > budget + 1) break
    blocks.push({ kind: 'block', minutes: block.minutes, unitId: unit.id, block })
    sum += block.minutes
    pos = nextPosition(course, pos)
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

  return { steps, courseComplete: pos === null }
}
