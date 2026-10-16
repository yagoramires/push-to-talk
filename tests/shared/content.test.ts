import { expect, test } from 'vitest'
import type { Exercise } from '../../src/shared/content'
import {
  findExercise,
  availableLevels,
  nextPosition,
  LevelExamSchema,
  PlacementSchema,
  UnitSchema
} from '../../src/shared/content'
import { makeCourse } from '../fixtures/course'

test('nextPosition walks blocks, then units, then ends', () => {
  const c = makeCourse()
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 0 })).toEqual({ unitId: 'u1', blockIndex: 1 })
  expect(nextPosition(c, { unitId: 'u1', blockIndex: 5 })).toEqual({ unitId: 'u2', blockIndex: 0 })
  expect(nextPosition(c, { unitId: 'u2', blockIndex: 5 })).toBeNull()
})

test('findExercise locates unit and block', () => {
  expect(findExercise(makeCourse(), 'u2-listening-ex')?.block?.kind).toBe('listening')
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

test('assessment schemas accept the fixture', () => {
  const c = makeCourse()
  expect(PlacementSchema.safeParse(c.placement).success).toBe(true)
  expect(LevelExamSchema.safeParse(c.exams!.A1).success).toBe(true)
})

test('PlacementSchema rejects a level with 3 listening items', () => {
  const p = structuredClone(makeCourse().placement!)
  p.levels[0].items[2].skill = 'listening'
  expect(PlacementSchema.safeParse(p).success).toBe(false)
})

test('PlacementSchema rejects missing or out-of-order levels', () => {
  const p = structuredClone(makeCourse().placement!)
  expect(PlacementSchema.safeParse({ levels: p.levels.slice(1) }).success).toBe(false)
  expect(PlacementSchema.safeParse({ levels: [...p.levels].reverse() }).success).toBe(false)
})

test('LevelExamSchema rejects an exam without the structure part', () => {
  const x = structuredClone(makeCourse().exams!.A1!)
  x.parts = x.parts.filter((p) => p.skill !== 'structure')
  expect(LevelExamSchema.safeParse(x).success).toBe(false)
})

test('LevelExamSchema rejects short parts and minutes outside 20-30', () => {
  const x = structuredClone(makeCourse().exams!.A1!)
  expect(LevelExamSchema.safeParse({ ...x, minutes: 31 }).success).toBe(false)
  x.parts[0].items.pop()
  expect(LevelExamSchema.safeParse(x).success).toBe(false)
})

test('assessment items: free_speak only in speaking, speaking must be spoken', () => {
  const free = {
    id: 'fs',
    kind: 'free_speak',
    instruction_pt: 'Fale',
    prompt_en: 'Talk.',
    guidelines_pt: ['x']
  }
  const x = structuredClone(makeCourse().exams!.A1!)
  const vocab = x.parts.find((p) => p.skill === 'vocabulary')!
  vocab.items[0].exercise = free as Exercise
  expect(LevelExamSchema.safeParse(x).success).toBe(false)

  const y = structuredClone(makeCourse().exams!.A1!)
  const speaking = y.parts.find((p) => p.skill === 'speaking')!
  speaking.items[0].exercise = free as Exercise
  expect(LevelExamSchema.safeParse(y).success).toBe(true)
  speaking.items[1].exercise = { ...choice } as Exercise
  expect(LevelExamSchema.safeParse(y).success).toBe(false)
})

test('findExercise finds assessment items, with unit from unitId or first unit of the level', () => {
  const c = makeCourse()
  const withUnit = findExercise(c, 'x-a1-listening-0')
  expect(withUnit?.exercise.id).toBe('x-a1-listening-0')
  expect(withUnit?.unit.id).toBe('u1')
  expect(withUnit?.block).toBeUndefined()
  expect(findExercise(c, 'x-a1-structure-3')?.unit.id).toBe('u1')
  expect(findExercise(c, 'p-A1-0')?.unit.id).toBe('u1')
  // nível sem unidades no curso: sem unidade para a revisão
  expect(findExercise(c, 'p-B2-0')).toBeUndefined()
})
