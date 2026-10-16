import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import {
  describePosition,
  flattenPlan,
  formatClock,
  shuffled,
  vocabAsRepeat
} from '../../src/renderer/src/flow'
import { checkAnswer } from '../../src/shared/matcher'
import { newProgress, recordAttempt } from '../../src/shared/progress'
import { buildSession } from '../../src/shared/session'

const course = makeCourse()

describe('flattenPlan', () => {
  test('review first, blocks mark their last exercise, wrapup last', () => {
    const p = recordAttempt(newProgress('p1', 'A1', course), {
      exerciseId: 'u1-warmup-ex',
      unitId: 'u1',
      transcript: 'x',
      verdict: 'error',
      at: '2026-10-15T10:00:00Z'
    })
    const items = flattenPlan(course, buildSession(course, p, 10))
    expect(items[0]).toMatchObject({ unitId: 'u1', label: 'Revisão dos erros' })
    expect(items[0].exercise.id).toBe('u1-warmup-ex')
    expect(items[0].completesBlockId).toBeUndefined()
    expect(items[1]).toMatchObject({ label: 'Aquecimento', completesBlockId: 'u1-warmup' })
    expect(items.at(-1)).toMatchObject({ label: 'Conversa final' })
    expect(items.at(-1)!.exercise.kind).toBe('free_speak')
  })

  test('skips review ids missing from the course', () => {
    const items = flattenPlan(course, {
      steps: [{ kind: 'review', minutes: 2, exerciseIds: ['gone', 'u2-review-ex'] }],
      courseComplete: false
    })
    expect(items.map((i) => i.exercise.id)).toEqual(['u2-review-ex'])
  })

  test('only the last exercise of a multi-exercise block completes it', () => {
    const block = course.units[0].blocks.find((b) => b.kind === 'conversation')!
    const items = flattenPlan(course, {
      steps: [{ kind: 'block', minutes: 4, unitId: 'u1', block }],
      courseComplete: false
    })
    expect(items.map((i) => i.completesBlockId)).toEqual([undefined, 'u1-conversation'])
  })
})

describe('shuffled', () => {
  test('is a permutation that differs from the input', () => {
    const words = ['Where', 'are', 'you', 'from']
    for (let i = 0; i < 20; i++) {
      const out = shuffled(words)
      expect([...out].sort()).toEqual([...words].sort())
      expect(out).not.toEqual(words)
    }
    expect(words).toEqual(['Where', 'are', 'you', 'from'])
  })

  test('falls back to reversed when the random source keeps the order', () => {
    expect(shuffled(['a', 'b', 'c'], () => 0.999)).toEqual(['c', 'b', 'a'])
  })

  test('single item and all-equal items are returned as is', () => {
    expect(shuffled(['a'])).toEqual(['a'])
    expect(shuffled(['a', 'a'])).toEqual(['a', 'a'])
  })
})

describe('vocabAsRepeat', () => {
  test('checks the example sentence', () => {
    const ex = vocabAsRepeat({
      id: 'v',
      kind: 'vocab',
      word_en: 'thank you',
      meaning_pt: 'obrigado',
      example_en: 'Thank you very much.'
    })
    expect(checkAnswer('thank you very much', ex).verdict).toBe('correct')
  })
})

describe('formatClock', () => {
  test('formats remaining and overtime', () => {
    expect(formatClock(600)).toBe('10:00')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(-0.4)).toBe('0:00')
    expect(formatClock(-75)).toBe('+1:15')
  })
})

describe('describePosition', () => {
  test('names block, unit and level; null at the end of the course', () => {
    expect(describePosition(course, { unitId: 'u2', blockIndex: 1 })).toBe('Vocabulário · u2 (A1)')
    expect(describePosition(course, null)).toBeNull()
    expect(describePosition(course, { unitId: 'nope', blockIndex: 0 })).toBeNull()
  })
})
