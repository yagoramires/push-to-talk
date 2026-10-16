import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import { newProgress, recordAttempt } from '../../src/shared/progress'
import { buildSession, type SessionPlan } from '../../src/shared/session'

const course = makeCourse()
const at = '2026-10-15T10:00:00Z'
const fresh = (): ReturnType<typeof newProgress> => newProgress('p1', 'A1', course)
const withError = (): ReturnType<typeof newProgress> =>
  recordAttempt(fresh(), {
    exerciseId: 'u1-warmup-ex',
    unitId: 'u1',
    transcript: 'x',
    verdict: 'error',
    at
  })
const kinds = (s: SessionPlan): string[] => s.steps.map((x) => x.kind)

describe('buildSession', () => {
  test('10 min with an open error: review, one block, wrapup', () => {
    const s = buildSession(course, withError(), 10)
    expect(kinds(s)).toEqual(['review', 'block', 'wrapup'])
    expect(s.steps[0].minutes).toBe(2)
  })

  test('30 min fresh covers exactly one unit', () => {
    const s = buildSession(course, fresh(), 30)
    const blocks = s.steps.filter((x) => x.kind === 'block')
    expect(blocks).toHaveLength(6)
    expect(blocks.every((b) => b.unitId === 'u1')).toBe(true)
    expect(s.steps.at(-1)).toMatchObject({ kind: 'wrapup', unitId: 'u1' })
    expect(s.courseComplete).toBe(false)
  })

  test('60 min runs out of course and flags completion', () => {
    const s = buildSession(course, fresh(), 60)
    expect(s.steps.filter((x) => x.kind === 'block')).toHaveLength(12)
    expect(s.courseComplete).toBe(true)
    expect(s.steps.at(-1)).toMatchObject({ kind: 'wrapup', unitId: 'u2' })
  })

  test('starts mid-unit and crosses into the next unit', () => {
    const p = { ...fresh(), position: { unitId: 'u1', blockIndex: 4 } }
    const units = buildSession(course, p, 30).steps.flatMap((x) =>
      x.kind === 'block' ? [x.unitId] : []
    )
    expect(units.slice(0, 2)).toEqual(['u1', 'u1'])
    expect(units[2]).toBe('u2')
  })

  test('review lists at most 5 open errors, oldest first', () => {
    let p = fresh()
    for (let i = 1; i <= 7; i++)
      p = recordAttempt(p, {
        exerciseId: `e${i}`,
        unitId: 'u1',
        transcript: 'x',
        verdict: 'error',
        at
      })
    p = recordAttempt(p, {
      exerciseId: 'e1',
      unitId: 'u1',
      transcript: 'x',
      verdict: 'correct',
      at
    })
    const review = buildSession(course, p, 30).steps[0]
    expect(review).toMatchObject({ kind: 'review', exerciseIds: ['e2', 'e3', 'e4', 'e5', 'e6'] })
    expect(review.minutes).toBe(5) // round(30 * 0.15) = 5
  })

  test('finished course: only review, courseComplete', () => {
    const s = buildSession(course, { ...withError(), position: null, courseComplete: true }, 20)
    expect(kinds(s)).toEqual(['review'])
    expect(s.courseComplete).toBe(true)
  })

  test('finished course with no open errors: empty plan, courseComplete', () => {
    const s = buildSession(course, { ...fresh(), position: null, courseComplete: true }, 20)
    expect(s.steps).toEqual([])
    expect(s.courseComplete).toBe(true)
  })

  test('no open errors: no review step', () => {
    expect(kinds(buildSession(course, fresh(), 20))[0]).toBe('block')
  })
})

describe('buildSession with level gating', () => {
  const a2 = makeCourse({ withA2: true })
  const at = (unitId: string, blockIndex = 0): ReturnType<typeof newProgress> => ({
    ...newProgress('p1', 'A1', a2),
    position: { unitId, blockIndex }
  })
  const blockUnits = (s: SessionPlan): string[] =>
    s.steps.flatMap((x) => (x.kind === 'block' ? [x.unitId] : []))

  test('stops at the end of the level, even with time left', () => {
    const s = buildSession(a2, at('u2', 4), 60)
    expect(blockUnits(s)).toEqual(['u2', 'u2'])
    expect(s.examDue).toBeNull()
    expect(s.courseComplete).toBe(false)
  })

  test('exam due: reinforces the last unit of the level, no next-level blocks', () => {
    const s = buildSession(a2, at('u3'), 30)
    expect(s.examDue).toBe('A1')
    expect(new Set(blockUnits(s))).toEqual(new Set(['u2']))
    expect(s.steps.at(-1)).toMatchObject({ kind: 'wrapup', unitId: 'u2' })
    expect(s.courseComplete).toBe(false)
  })

  test('exam due with weak units: reinforces those units', () => {
    const s = buildSession(a2, { ...at('u3'), weakUnits: ['u1'] }, 30)
    expect(new Set(blockUnits(s))).toEqual(new Set(['u1']))
  })

  test('reached level A2: crosses into u3', () => {
    expect(blockUnits(buildSession(a2, { ...at('u2', 4), level: 'A2' }, 60))).toContain('u3')
  })
})
