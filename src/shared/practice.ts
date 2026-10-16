import type { Course } from './content'
import type { FinalVerdict } from './matcher'
import type { ProfileProgress } from './progress'
import type { Duration, SessionPlan } from './session'

/** Days until an item in box 1..5 is ready again. */
export const INTERVALS = [0, 1, 3, 7, 14]

/** Local calendar day as a number, so "today" follows the person's clock (rounding absorbs DST). */
const dayNum = (d: Date): number =>
  Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)

/** Practice ids of units with every block done, plus the weak units, in course order. */
export function practicePool(course: Course, p: ProfileProgress): string[] {
  return course.units
    .filter(
      (u) => p.weakUnits.includes(u.id) || u.blocks.every((b) => p.completedBlocks.includes(b.id))
    )
    .flatMap((u) => u.practice.map((e) => e.id))
}

/** Ready items, most overdue first; never-seen items last, in pool order. */
export function dueItems(pool: string[], p: ProfileProgress, now: Date): string[] {
  const today = dayNum(now)
  const seen = pool
    .filter((id) => p.practice[id])
    .map((id) => {
      const { box, last } = p.practice[id]
      return { id, overdue: today - dayNum(new Date(last)) - INTERVALS[box - 1] }
    })
    .filter((x) => x.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue)
  return [...seen.map((x) => x.id), ...pool.filter((id) => !p.practice[id])]
}

/** One review step, ~1 exercise per minute; tops up with the least recently answered items. */
export function buildPracticeSession(
  course: Course,
  p: ProfileProgress,
  minutes: Duration,
  now: Date
): SessionPlan {
  const pool = practicePool(course, p)
  const due = dueItems(pool, p, now)
  const rest = pool
    .filter((id) => !due.includes(id))
    .sort((a, b) => p.practice[a].last.localeCompare(p.practice[b].last))
  const exerciseIds = [...due, ...rest].slice(0, minutes)
  return {
    steps: exerciseIds.length ? [{ kind: 'review', minutes, exerciseIds }] : [],
    courseComplete: false,
    examDue: null
  }
}

/** Leitner: correct climbs a box (up to 5), "almost" stays, error goes back to box 1. */
export function recordPractice(
  p: ProfileProgress,
  exerciseId: string,
  verdict: FinalVerdict | 'almost',
  at: string
): ProfileProgress {
  const box = p.practice[exerciseId]?.box ?? 1
  const next = verdict === 'error' ? 1 : verdict === 'almost' ? box : Math.min(box + 1, 5)
  return {
    ...p,
    practice: { ...p.practice, [exerciseId]: { box: next as 1 | 2 | 3 | 4 | 5, last: at } }
  }
}
