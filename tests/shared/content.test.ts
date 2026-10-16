import { expect, test } from 'vitest'
import type { Exercise } from '../../src/shared/content'
import { findExercise, availableLevels, nextPosition, UnitSchema } from '../../src/shared/content'
import { makeCourse } from '../fixtures/course'

test('nextPosition walks blocks, then units, then ends', () => {
  const c = makeCourse()
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 0 })).toEqual({ unitId: 'u1', blockIndex: 1 })
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 5 })).toEqual({ unitId: 'u2', blockIndex: 0 })
  expect(nextPosition(c, { unitId: 'u2', blockIndex: 5 })).toBeNull()
})

test('findExercise locates unit and block', () => {
  expect(findExercise(makeCourse(), 'u2-listening-ex')?.block.kind).toBe('listening')
  expect(findExercise(makeCourse(), 'nope')).toBeUndefined()
})

test('availableLevels lists levels present, in level order', () => {
  expect(availableLevels(makeCourse())).toEqual(['A1'])
})

test('fixture course is valid', () => {
  for (const u of makeCourse().units) expect(UnitSchema.safeParse(u).success).toBe(true)
})

test('UnitSchema rejects spoken exercise without accepted answers', () => {
  const u = structuredClone(makeCourse().units[0])
  Object.assign(u.blocks[0].exercises[0], { accepted: [] })
  expect(UnitSchema.safeParse(u).success).toBe(false)
})

function withExercise(ex: unknown): ReturnType<typeof UnitSchema.safeParse> {
  const u = structuredClone(makeCourse().units[0])
  u.blocks[0].exercises.push(ex as Exercise)
  return UnitSchema.safeParse(u)
}
const choice = { id: 'c', kind: 'choice', instruction_pt: 'x', options: ['a', 'b', 'c'], answer: 1 }
const fill = {
  id: 'f',
  kind: 'fill',
  instruction_pt: 'x',
  sentence: 'I ___ happy',
  accepted: ['am'],
  commonErrors: []
}

test('UnitSchema accepts valid choice and fill', () => {
  expect(withExercise(choice).success).toBe(true)
  expect(withExercise(fill).success).toBe(true)
})

test('UnitSchema rejects choice answer out of range', () => {
  expect(withExercise({ ...choice, answer: 3 }).success).toBe(false)
  expect(withExercise({ ...choice, answer: -1 }).success).toBe(false)
})

test('UnitSchema rejects choice with 1 or 6 options', () => {
  expect(withExercise({ ...choice, options: ['a'], answer: 0 }).success).toBe(false)
  expect(withExercise({ ...choice, options: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false)
})

test('UnitSchema rejects fill without exactly one ___', () => {
  expect(withExercise({ ...fill, sentence: 'I am happy' }).success).toBe(false)
  expect(withExercise({ ...fill, sentence: 'I ___ ___ happy' }).success).toBe(false)
})

test('UnitSchema rejects match with fewer than 3 or more than 6 pairs', () => {
  const pair = { en: 'a', pt: 'b' }
  const match = { id: 'm', kind: 'match', instruction_pt: 'x' }
  expect(withExercise({ ...match, pairs: [pair, pair] }).success).toBe(false)
  expect(withExercise({ ...match, pairs: Array(3).fill(pair) }).success).toBe(true)
  expect(withExercise({ ...match, pairs: Array(7).fill(pair) }).success).toBe(false)
})

test('UnitSchema rejects invalid commonErrors regex and bad minutes', () => {
  const bad = {
    ...fill,
    commonErrors: [{ id: 'e', match: '(', explanation_pt: 'x', correction_en: 'y' }]
  }
  expect(withExercise(bad).success).toBe(false)
  const u = structuredClone(makeCourse().units[0])
  u.blocks[0].minutes = 16
  expect(UnitSchema.safeParse(u).success).toBe(false)
})

test('UnitSchema requires prompt on repeat and listen on listen_answer', () => {
  const repeat = {
    id: 'r',
    kind: 'repeat',
    instruction_pt: 'x',
    prompt: 'Hi',
    accepted: ['hi'],
    commonErrors: []
  }
  const listen = {
    id: 'l',
    kind: 'listen_answer',
    instruction_pt: 'x',
    listen: 'Hi',
    accepted: ['hi'],
    commonErrors: []
  }
  expect(withExercise(repeat).success).toBe(true)
  expect(withExercise(listen).success).toBe(true)
  expect(withExercise({ ...repeat, prompt: undefined }).success).toBe(false)
  expect(withExercise({ ...listen, listen: undefined }).success).toBe(false)
  expect(withExercise({ ...repeat, kind: 'translate', prompt: undefined }).success).toBe(true)
})
