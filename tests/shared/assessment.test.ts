import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import {
  applyExamResult,
  currentPlacementItems,
  examDue,
  finishPlacementLevel,
  passes,
  startPlacement
} from '../../src/shared/assessment'
import { SKILLS, type Skill } from '../../src/shared/content'
import { newProgress, type ProfileProgress } from '../../src/shared/progress'

const r = (skill: Skill, correct: boolean): { skill: Skill; correct: boolean } => ({
  skill,
  correct
})
const at = '2026-10-16T10:00:00Z'

describe('passes', () => {
  test('5/6 with listening 1/2 and speaking 1/2 passes', () => {
    const res = passes([
      r('listening', true),
      r('listening', false),
      r('speaking', true),
      r('speaking', true),
      r('vocabulary', true),
      r('structure', true)
    ])
    expect(res.passed).toBe(true)
    expect(res.scores).toEqual({ listening: 0.5, speaking: 1, vocabulary: 1, structure: 1 })
    expect(res.total).toBeCloseTo(5 / 6)
  })

  test('4/6 fails', () => {
    const res = passes([
      r('listening', true),
      r('listening', false),
      r('speaking', true),
      r('speaking', false),
      r('vocabulary', true),
      r('structure', true)
    ])
    expect(res.passed).toBe(false)
  })

  test('total above 70% still fails when one skill is below 50%', () => {
    // 5/6 with speaking 0/2 is impossible (that is 4/6), so use 7/9 with speaking 0/2.
    const res = passes([
      ...Array(7).fill(r('listening', true)),
      r('speaking', false),
      r('speaking', false)
    ])
    expect(res.total).toBeCloseTo(7 / 9)
    expect(res.passed).toBe(false)
  })

  test('no results does not pass', () => {
    expect(passes([]).passed).toBe(false)
  })
})

describe('examDue', () => {
  const a2 = makeCourse({ withA2: true })
  const atUnit = (unitId: string): ProfileProgress => ({
    ...newProgress('p1', 'A1', a2),
    position: { unitId, blockIndex: 0 }
  })

  test('position in a higher level with level A1 → A1', () => {
    expect(examDue(atUnit('u3'), a2)).toBe('A1')
  })

  test('end of the course counts as leaving the level', () => {
    expect(examDue({ ...atUnit('u1'), position: null }, a2)).toBe('A1')
  })

  test('still inside the level → null', () => {
    expect(examDue(atUnit('u1'), a2)).toBeNull()
  })

  test('exam already passed → null', () => {
    const p = atUnit('u3')
    const record = {
      level: 'A1' as const,
      at,
      mode: 'solo' as const,
      scores: {} as never,
      total: 1,
      passed: true
    }
    expect(examDue({ ...p, exams: [record] }, a2)).toBeNull()
    expect(examDue({ ...p, exams: [{ ...record, passed: false }] }, a2)).toBe('A1')
  })

  test('no exam content for the level → null', () => {
    expect(examDue({ ...atUnit('u3'), level: 'A2' }, a2)).toBeNull()
  })
})

describe('applyExamResult', () => {
  const a2 = makeCourse({ withA2: true })
  const exam = a2.exams!.A1!
  const p = (): ProfileProgress => ({
    ...newProgress('p1', 'A1', a2),
    position: { unitId: 'u3', blockIndex: 0 }
  })
  /** Answers every exam item; `wrong` lists exercise ids answered wrong. */
  const answers = (wrong: string[] = []): Parameters<typeof applyExamResult>[3] =>
    exam.parts.flatMap((part) =>
      part.items.map((i) => ({
        exerciseId: i.exercise.id,
        skill: i.skill,
        unitId: i.unitId,
        correct: !wrong.includes(i.exercise.id),
        transcript: 'x'
      }))
    )

  test('passed → next level, record saved, weakUnits cleared', () => {
    const { progress, record } = applyExamResult(
      { ...p(), weakUnits: ['u1'] },
      a2,
      exam,
      answers(['x-a1-speaking-0']),
      at,
      'guided'
    )
    expect(record).toMatchObject({ level: 'A1', mode: 'guided', passed: true, at })
    expect(Object.keys(record.scores).sort()).toEqual([...SKILLS].sort())
    expect(record.scores.speaking).toBe(0.75)
    expect(progress).toMatchObject({ level: 'A2', weakUnits: [], courseComplete: false })
    expect(progress.exams).toEqual([record])
    expect(examDue(progress, a2)).toBeNull()
  })

  test('failed → errors logged, weak units from wrong items, level unchanged', () => {
    const wrong = ['x-a1-listening-0', 'x-a1-listening-1', 'x-a1-listening-2', 'x-a1-vocabulary-0']
    const { progress, record } = applyExamResult(p(), a2, exam, answers(wrong), at, 'solo')
    expect(record.passed).toBe(false)
    expect(progress.level).toBe('A1')
    expect(progress.errorLog.map((e) => e.exerciseId)).toEqual(wrong)
    // listening items point to u1; vocabulary has no unitId → last A1 unit (u2)
    expect(progress.weakUnits).toEqual(['u1', 'u2'])
    expect(progress.errorLog.at(-1)?.unitId).toBe('u2')
    expect(examDue(progress, a2)).toBe('A1')
  })

  test('a correct answer resolves an earlier error on the same item', () => {
    const first = applyExamResult(p(), a2, exam, answers(['x-a1-structure-0']), at, 'solo')
    const again = applyExamResult(first.progress, a2, exam, answers(), at, 'solo')
    expect(again.progress.errorLog.every((e) => e.resolved)).toBe(true)
  })

  test('passing C1 completes the course', () => {
    const c1 = { ...exam, level: 'C1' as const }
    const { progress } = applyExamResult({ ...p(), level: 'C1' }, a2, c1, answers(), at, 'solo')
    expect(progress).toMatchObject({ level: 'C1', courseComplete: true })
  })
})

describe('placement engine', () => {
  const placement = makeCourse().placement!
  const level = (correct: number): { skill: Skill; correct: boolean }[] =>
    (['listening', 'listening', 'speaking', 'speaking', 'vocabulary', 'structure'] as Skill[]).map(
      (skill, i) => r(skill, i < correct)
    )
  const PASS = level(6)
  const FAIL = level(4)

  test('starts at A1 with its 6 items', () => {
    const s = startPlacement()
    expect(s).toEqual({ levelIndex: 0, answers: [], done: false, result: null })
    expect(currentPlacementItems(placement, s).map((i) => i.exercise.id)).toEqual(
      placement.levels[0].items.map((i) => i.exercise.id)
    )
  })

  test('fails A1 → result A1', () => {
    const s = finishPlacementLevel(startPlacement(), FAIL)
    expect(s).toMatchObject({ done: true, result: 'A1', levelIndex: 0 })
    expect(s.answers).toHaveLength(6)
    expect(s.answers.every((a) => a.level === 'A1')).toBe(true)
  })

  test('passes A1 and A2, fails B1 → result B1', () => {
    let s = finishPlacementLevel(startPlacement(), PASS)
    expect(s).toMatchObject({ done: false, levelIndex: 1, result: null })
    expect(currentPlacementItems(placement, s)).toBe(placement.levels[1].items)
    // 5/6 missing one listening item still passes
    s = finishPlacementLevel(s, [r('listening', false), ...PASS.slice(1)])
    s = finishPlacementLevel(s, FAIL)
    expect(s).toMatchObject({ done: true, result: 'B1' })
    expect(s.answers.map((a) => a.level)).toEqual([
      ...Array(6).fill('A1'),
      ...Array(6).fill('A2'),
      ...Array(6).fill('B1')
    ])
  })

  test('passes everything → result C1 and done, without overflowing', () => {
    let s = startPlacement()
    for (let i = 0; i < 5; i++) s = finishPlacementLevel(s, PASS)
    expect(s).toMatchObject({ done: true, result: 'C1', levelIndex: 4 })
    expect(currentPlacementItems(placement, s)).toBe(placement.levels[4].items)
  })
})
