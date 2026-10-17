import { LEVELS, type Level } from './content'
import type { SessionRecord } from './progress'

export type Goal = {
  target: Level
  months: 1 | 3 | 6 | 12
  daysPerWeek: 5 | 6 | 7
  createdAt: string
}
export const GOAL_MONTHS: Goal['months'][] = [1, 3, 6, 12]
export const GOAL_DAYS: Goal['daysPerWeek'][] = [5, 6, 7]

/** Hours to finish each level from zero (Cambridge estimate of guided learning hours). */
export const LEVEL_HOURS: Record<Level, number> = { A1: 100, A2: 200, B1: 400, B2: 600, C1: 800 }

export type GoalPlan = {
  hoursLeft: number
  minutesPerDay: number
  feasibility: 'ok' | 'puxado' | 'irreal' | 'alcancada'
  suggestedMonths: Goal['months'] | null
}

// × 7 ÷ (30 × months) is "÷ weeks" kept in integers, so 700 stays 700 and not 700.0000001.
/** days = calendar days left until the deadline; a passed deadline counts as 1 day. */
const perDay = (hours: number, days: number, daysPerWeek: number): number =>
  Math.ceil((hours * 60 * 7) / (Math.max(days, 1) * daysPerWeek) / 5) * 5

export function planGoal(o: {
  level: Level
  target: Level
  months: Goal['months']
  daysPerWeek: Goal['daysPerWeek']
  studiedMinutes: number
  /** Days left until createdAt + months; defaults to the whole deadline (a goal being created). */
  daysLeft?: number
}): GoalPlan {
  const current = LEVELS.indexOf(o.level)
  if (LEVELS.indexOf(o.target) < current)
    return { hoursLeft: 0, minutesPerDay: 0, feasibility: 'alcancada', suggestedMonths: null }
  const done = current > 0 ? LEVEL_HOURS[LEVELS[current - 1]] : 0
  const hoursLeft = Math.max(0, LEVEL_HOURS[o.target] - done - o.studiedMinutes / 60)
  const minutesPerDay = perDay(hoursLeft, o.daysLeft ?? 30 * o.months, o.daysPerWeek)
  const feasibility = minutesPerDay <= 60 ? 'ok' : minutesPerDay <= 120 ? 'puxado' : 'irreal'
  const suggestedMonths =
    feasibility === 'irreal'
      ? (GOAL_MONTHS.find((m) => perDay(hoursLeft, 30 * m, o.daysPerWeek) <= 60) ?? null)
      : null
  return { hoursLeft, minutesPerDay, feasibility, suggestedMonths }
}

const dayStart = (d: Date, offset = 0): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)

/** Local dates; a session counts on the day it ended; the week starts on Monday. */
export function studyStats(
  sessions: SessionRecord[],
  now: Date
): {
  todayMinutes: number
  weekMinutes: number
  avgPerDay14: number
  activeDays14: number
  streakDays: number
} {
  const ends = sessions.map((s) => ({
    end: new Date(Date.parse(s.at) + s.minutes * 60000),
    minutes: s.minutes
  }))
  const since = (from: Date): number =>
    ends.filter((e) => e.end >= from).reduce((sum, e) => sum + e.minutes, 0)
  const from14 = dayStart(now, -13)
  const days = new Set(ends.map((e) => e.end.toDateString()))
  let day = dayStart(now, days.has(now.toDateString()) ? 0 : -1)
  let streakDays = 0
  while (days.has(day.toDateString())) {
    streakDays++
    day = dayStart(day, -1)
  }
  return {
    todayMinutes: since(dayStart(now)),
    weekMinutes: since(dayStart(now, -((now.getDay() + 6) % 7))),
    avgPerDay14: since(dayStart(now, -13)) / 14,
    activeDays14: new Set(ends.filter((e) => e.end >= from14).map((e) => e.end.toDateString()))
      .size,
    streakDays
  }
}

export function projectedFinish(hoursLeft: number, avgPerDay14: number, now: Date): Date | null {
  if (avgPerDay14 <= 0) return null
  return dayStart(now, Math.ceil((hoursLeft * 60) / avgPerDay14))
}

/** Minutes studied since the goal was created (all sessions, exams and placement included). */
export const minutesSince = (sessions: SessionRecord[], createdAt: string): number =>
  sessions.filter((s) => s.at >= createdAt).reduce((sum, s) => sum + s.minutes, 0)

/** Calendar days from now until the goal's deadline (createdAt + months × 30 days); can be <= 0. */
export function goalDaysLeft(goal: Pick<Goal, 'createdAt' | 'months'>, now: Date): number {
  const end = Date.parse(goal.createdAt) + goal.months * 30 * 86_400_000
  return Math.ceil((end - now.getTime()) / 86_400_000)
}
