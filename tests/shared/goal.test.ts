import { describe, expect, test } from 'vitest'
import {
  LEVEL_HOURS,
  goalDaysLeft,
  planGoal,
  projectedFinish,
  studyStats
} from '../../src/shared/goal'
import type { SessionRecord } from '../../src/shared/progress'

const base = { level: 'A2', target: 'B1', months: 6, daysPerWeek: 6, studiedMinutes: 0 } as const

describe('planGoal', () => {
  test('LEVEL_HOURS are the cumulative Cambridge estimates', () => {
    expect(LEVEL_HOURS).toEqual({ A1: 100, A2: 200, B1: 400, B2: 600, C1: 800 })
  })

  test('A2 → B1 in 6 months, 6 days a week: 300 h, 120 min/day, puxado', () => {
    expect(planGoal(base)).toEqual({
      hoursLeft: 300,
      minutesPerDay: 120,
      feasibility: 'puxado',
      suggestedMonths: null
    })
  })

  test('1 month is irreal and suggests the smallest deadline that fits in 60 min (12)', () => {
    expect(planGoal({ ...base, months: 1 })).toEqual({
      hoursLeft: 300,
      minutesPerDay: 700,
      feasibility: 'irreal',
      suggestedMonths: 12
    })
    expect(planGoal({ ...base, months: 12 })).toMatchObject({
      minutesPerDay: 60,
      feasibility: 'ok'
    })
    expect(planGoal({ ...base, months: 3 }).minutesPerDay).toBe(235)
  })

  test('A1 → C1 in 12 months: no deadline in the list fits', () => {
    expect(planGoal({ ...base, level: 'A1', target: 'C1', months: 12 })).toEqual({
      hoursLeft: 800,
      minutesPerDay: 160,
      feasibility: 'irreal',
      suggestedMonths: null
    })
  })

  test('target = current level counts that level from the start', () => {
    expect(planGoal({ ...base, level: 'A1', target: 'A1', months: 3 }).hoursLeft).toBe(100)
  })

  test('a level already passed is alcancada with 0 min/day (uses the current level)', () => {
    expect(planGoal({ ...base, level: 'B2', target: 'B1' })).toMatchObject({
      feasibility: 'alcancada',
      minutesPerDay: 0
    })
  })

  test('studied minutes are taken off the hours left', () => {
    expect(planGoal({ ...base, studiedMinutes: 6000 }).hoursLeft).toBe(200)
  })
})

const at = (d: number, h: number, m = 0): string => new Date(2026, 9, d, h, m).toISOString()
const s = (iso: string, minutes: number): SessionRecord => ({
  at: iso,
  mode: 'solo',
  minutes,
  blocksDone: [],
  errors: 0
})
const now = new Date(2026, 9, 16, 12, 0) // Friday

describe('studyStats', () => {
  test('a session that crosses midnight counts on the day it ended', () => {
    const stats = studyStats(
      [s(at(14, 9), 15), s(at(15, 23, 50), 20), s(at(16, 8), 30), s(at(11, 9), 40)],
      now
    )
    expect(stats.todayMinutes).toBe(50)
    expect(stats.weekMinutes).toBe(65) // Mon 12 onward; Sunday 11 is last week
    expect(stats.avgPerDay14).toBeCloseTo(105 / 14)
    expect(stats.streakDays).toBe(1) // the 15th has no session that ended on it
  })

  test('no sessions: all zero, no NaN', () => {
    expect(studyStats([], now)).toEqual({
      todayMinutes: 0,
      weekMinutes: 0,
      avgPerDay14: 0,
      activeDays14: 0,
      streakDays: 0
    })
  })

  test('streak counts up to yesterday when today is still empty', () => {
    const stats = studyStats([s(at(13, 9), 10), s(at(14, 9), 10), s(at(15, 9), 10)], now)
    expect(stats.streakDays).toBe(3)
    expect(stats.todayMinutes).toBe(0)
  })
})

describe('studyStats activeDays14', () => {
  test('counts distinct days in the last 14, ignoring older ones', () => {
    const sessions = [s(at(16, 9), 5), s(at(16, 10), 5), s(at(15, 9), 5), s(at(2, 9), 5)]
    expect(studyStats(sessions, now).activeDays14).toBe(2)
  })
})

describe('projectedFinish', () => {
  test('null without a pace; otherwise now + the days needed', () => {
    expect(projectedFinish(100, 0, now)).toBeNull()
    expect(projectedFinish(10, 60, now)?.getDate()).toBe(26)
  })
})

describe('goal adapts to the days left', () => {
  const base = { level: 'A2', target: 'B1', months: 6, daysPerWeek: 6, studiedMinutes: 0 } as const
  test('halfway through a 6-month goal with nothing studied, the daily target rises', () => {
    expect(planGoal({ ...base, daysLeft: 90 })).toMatchObject({
      minutesPerDay: 235,
      feasibility: 'irreal'
    })
  })
  test('more time left means more slack', () => {
    expect(planGoal({ ...base, daysLeft: 360 }).minutesPerDay).toBe(60)
  })
  test('a passed deadline counts as one day, never divides by zero', () => {
    expect(Number.isFinite(planGoal({ ...base, daysLeft: -5 }).minutesPerDay)).toBe(true)
  })
  test('goalDaysLeft counts from createdAt + months × 30 days', () => {
    const goal = { createdAt: '2026-01-01T00:00:00Z', months: 1 as const }
    expect(goalDaysLeft(goal, new Date('2026-01-21T00:00:00Z'))).toBe(10)
  })
})
