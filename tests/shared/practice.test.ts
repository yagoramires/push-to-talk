import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import type { Course, Exercise } from '../../src/shared/content'
import { findExercise } from '../../src/shared/content'
import { newProgress, type ProfileProgress } from '../../src/shared/progress'
import {
  buildPracticeSession,
  dueItems,
  practicePool,
  recordPractice
} from '../../src/shared/practice'
import { buildSession, type Duration } from '../../src/shared/session'

const rep = (id: string): Exercise => ({
  id,
  kind: 'repeat',
  instruction_pt: 'Repita',
  prompt: 'Hi',
  accepted: ['hi'],
  commonErrors: []
})
const withPractice = (): Course => {
  const c = makeCourse()
  c.units[0].practice = ['p1', 'p2', 'p3'].map(rep)
  c.units[1].practice = ['q1'].map(rep)
  return c
}
const course = withPractice()
const blocksOf = (unitId: string): string[] =>
  course.units.find((u) => u.id === unitId)!.blocks.map((b) => b.id)
/** u1 fully done. */
const done = (): ProfileProgress => ({
  ...newProgress('p1', 'A1', course),
  completedBlocks: blocksOf('u1')
})
const day = (d: number): Date => new Date(2026, 9, d, 12)
const iso = (d: number): string => day(d).toISOString()

describe('recordPractice', () => {
  test('Leitner: correct climbs to 5 and stops; almost stays; error goes back to 1', () => {
    let p = done()
    const box = (): number => p.practice.p1.box
    p = recordPractice(p, 'p1', 'correct', iso(1))
    expect(box()).toBe(2)
    for (let i = 0; i < 5; i++) p = recordPractice(p, 'p1', 'correct', iso(1))
    expect(box()).toBe(5)
    p = recordPractice(p, 'p1', 'almost', iso(2))
    expect(p.practice.p1).toEqual({ box: 5, last: iso(2) })
    p = recordPractice(p, 'p1', 'error', iso(3))
    expect(box()).toBe(1)
    expect(recordPractice(done(), 'p2', 'error', iso(1)).practice.p2.box).toBe(1)
  })
})

describe('practicePool and dueItems', () => {
  test('pool: practice of finished units plus weak units, course order', () => {
    expect(practicePool(course, newProgress('p1', 'A1', course))).toEqual([])
    expect(practicePool(course, done())).toEqual(['p1', 'p2', 'p3'])
    expect(practicePool(course, { ...done(), weakUnits: ['u2'] })).toEqual(['p1', 'p2', 'p3', 'q1'])
  })

  test('respects intervals; most overdue first, never seen last in course order', () => {
    let p = done()
    p = recordPractice(p, 'p3', 'correct', iso(1)) // box 2, due day 2
    p = recordPractice(p, 'p2', 'error', iso(3)) // box 1, due day 3
    const pool = practicePool(course, p)
    expect(dueItems(pool, p, day(1))).toEqual(['p1'])
    expect(dueItems(pool, p, day(3))).toEqual(['p3', 'p2', 'p1'])
    p = recordPractice(p, 'p3', 'correct', iso(3)) // box 3, due day 6
    expect(dueItems(pool, p, day(5))).toEqual(['p2', 'p1'])
    expect(dueItems(pool, p, day(8))).toEqual(['p2', 'p3', 'p1'])
  })
})

describe('buildPracticeSession', () => {
  test('empty pool gives no steps', () => {
    expect(buildPracticeSession(course, newProgress('p1', 'A1', course), 10, day(1)).steps).toEqual(
      []
    )
  })

  test('one review step of due items, about one per minute', () => {
    const s = buildPracticeSession(course, done(), 10, day(1))
    expect(s.steps).toEqual([{ kind: 'review', minutes: 10, exerciseIds: ['p1', 'p2', 'p3'] }])
    expect(s.examDue).toBeNull()
  })

  test('everything up to date: brings the oldest ones, never empty', () => {
    const at = (h: number): string => new Date(2026, 9, 1, h).toISOString()
    let p = done()
    p = recordPractice(p, 'p2', 'correct', at(8))
    p = recordPractice(p, 'p1', 'correct', at(9))
    p = recordPractice(p, 'p3', 'correct', at(10))
    expect(dueItems(practicePool(course, p), p, day(1))).toEqual([])
    const s = buildPracticeSession(course, p, 10, day(1))
    expect(s.steps[0]).toMatchObject({ kind: 'review', exerciseIds: ['p2', 'p1', 'p3'] })
    // 2 minutes: 2 items, the ready one first
    p = recordPractice(p, 'p3', 'error', at(11))
    const two = buildPracticeSession(course, p, 2 as Duration, day(1))
    expect(two.steps[0]).toMatchObject({ exerciseIds: ['p3', 'p2'] })
  })
})

describe('integration', () => {
  test('findExercise finds practice items', () => {
    expect(findExercise(course, 'q1')).toMatchObject({ unit: { id: 'u2' }, exercise: { id: 'q1' } })
  })

  test('normal session without open errors reviews up to 2 due items', () => {
    const s = buildSession(course, done(), 30, day(1))
    expect(s.steps[0]).toMatchObject({ kind: 'review', exerciseIds: ['p1', 'p2'] })
    expect(buildSession(makeCourse(), done(), 30, day(1)).steps[0].kind).toBe('block')
  })
})
