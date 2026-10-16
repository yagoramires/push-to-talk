import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import {
  describeHardware,
  describePosition,
  flattenPlan,
  formatClock,
  formatSize,
  placementStartLevel,
  skillSummary,
  shuffled,
  vocabAsRepeat
} from '../../src/renderer/src/flow'
import { checkAnswer } from '../../src/shared/matcher'
import { downloadBytes } from '../../src/shared/models'
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

  test('items carry their step index, step minutes and block', () => {
    const plan = buildSession(course, newProgress('p1', 'A1', course), 10)
    const items = flattenPlan(course, plan)
    for (const item of items) {
      const step = plan.steps[item.stepIndex]
      expect(item.stepMinutes).toBe(step.minutes)
      if (step.kind === 'block') expect(item.block).toBe(step.block)
    }
    expect(new Set(items.map((i) => i.stepIndex)).size).toBeGreaterThan(1)
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
    expect(items.map((i) => i.completesBlockId)).toEqual([undefined, undefined, 'u1-conversation'])
  })
})

describe('flattenPlan wrapup dedup', () => {
  test('30 min covering the conversation block asks its free_speak once', () => {
    const items = flattenPlan(course, buildSession(course, newProgress('p1', 'A1', course), 30))
    expect(items.filter((i) => i.exercise.id === 'u1-conv-free')).toHaveLength(1)
    expect(items.some((i) => i.label === 'Conversa final')).toBe(false)
  })

  test('10 min with an open error keeps the wrapup', () => {
    const p = recordAttempt(newProgress('p1', 'A1', course), {
      exerciseId: 'u1-warmup-ex',
      unitId: 'u1',
      transcript: 'x',
      verdict: 'error',
      at: '2026-10-15T10:00:00Z'
    })
    const items = flattenPlan(course, buildSession(course, p, 10))
    expect(items.at(-1)).toMatchObject({ label: 'Conversa final' })
    expect(items.filter((i) => i.exercise.id === 'u1-conv-free')).toHaveLength(1)
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

describe('AI setup texts', () => {
  test('describeHardware lists processor, RAM and GPU in Portuguese', () => {
    const hw = {
      platform: 'darwin',
      arch: 'arm64',
      totalMemGB: 16,
      cpuModel: 'Apple M2',
      cores: 8,
      hasDiscreteGpu: false
    }
    expect(describeHardware(hw)).toEqual([
      'Processador: Apple M2 (8 núcleos)',
      'Memória: 16 GB de RAM',
      'Placa de vídeo dedicada: não'
    ])
  })

  test('download size per tier adds speech, pronunciation and text model', () => {
    expect(downloadBytes('light')).toBe((77 + 318 + 1281) * 1e6)
    expect(formatSize(downloadBytes('light'))).toBe('1,7 GB')
    // medium/strong add whisper small (252 MB) to base
    expect(downloadBytes('strong')).toBe((77 + 252 + 318 + 5681) * 1e6)
    expect(formatSize(downloadBytes('strong'))).toBe('6,3 GB')
    expect(formatSize(395e6)).toBe('395 MB')
  })
})

describe('placementStartLevel', () => {
  test('uses the result when the course has it', () => {
    expect(placementStartLevel('A2', ['A1', 'A2', 'B1'])).toBe('A2')
  })
  test('falls back to the highest available level below the result', () => {
    expect(placementStartLevel('B1', ['A1'])).toBe('A1')
    expect(placementStartLevel('C1', ['A1', 'A2'])).toBe('A2')
  })
  test('no level at or below the result: the lowest available', () => {
    expect(placementStartLevel('A1', ['A2'])).toBe('A2')
  })
})

describe('skillSummary', () => {
  test('counts per skill in SKILLS order, skipping absent skills', () => {
    expect(
      skillSummary([
        { skill: 'speaking', correct: true },
        { skill: 'listening', correct: false },
        { skill: 'speaking', correct: false },
        { skill: 'listening', correct: true }
      ])
    ).toEqual([
      { skill: 'listening', correct: 1, total: 2 },
      { skill: 'speaking', correct: 1, total: 2 }
    ])
  })
})
