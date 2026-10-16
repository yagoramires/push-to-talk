import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadCourse } from '../src/main/content/load-course'
import { BLOCK_KINDS, LEVELS, SPOKEN_KINDS, type Exercise } from '../src/shared/content'
import { checkAnswer, normalize } from '../src/shared/matcher'

test('all units in content/ are valid', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  for (const u of course.units) {
    expect(u.blocks.map((b) => b.kind)).toEqual([...BLOCK_KINDS])
    const total = u.blocks.reduce((s, b) => s + b.minutes, 0)
    expect(total).toBeGreaterThanOrEqual(24)
    expect(total).toBeLessThanOrEqual(28)
    for (const b of u.blocks) {
      expect(new Set(b.exercises.map((e) => e.kind)).size).toBeGreaterThanOrEqual(2)
      expect(b.teacher.prompts.length).toBeGreaterThanOrEqual(2)
      expect(b.teacher.prompts.length).toBeLessThanOrEqual(4)
      expect(b.teacher.watchFor.length).toBeGreaterThanOrEqual(2)
      expect(b.teacher.watchFor.length).toBeLessThanOrEqual(3)
    }
    const all = u.blocks.flatMap((b) => b.exercises)
    expect(
      all.filter((e) => (SPOKEN_KINDS as readonly string[]).includes(e.kind)).length * 2
    ).toBeGreaterThanOrEqual(all.length)
    expect(
      u.blocks
        .find((b) => b.kind === 'conversation')!
        .exercises.some((e) => e.kind === 'free_speak')
    ).toBe(true)
  }
  const kindsUsed = new Set(
    course.units.flatMap((u) => u.blocks.flatMap((b) => b.exercises.map((e) => e.kind)))
  )
  expect([...kindsUsed].sort()).toEqual([
    'choice',
    'dialogue',
    'fill',
    'free_speak',
    'listen_answer',
    'match',
    'order',
    'repeat',
    'translate',
    'vocab'
  ])
})

test('a1-02 teaches "Eu tenho 25 anos" with the have-years error', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  const ex = course.units[1].blocks
    .flatMap((b) => b.exercises)
    .find((e) => e.id === 'a1-02-age-translate')
  expect(ex?.kind).toBe('translate')
  if (ex?.kind !== 'translate') return
  expect(ex.instruction_pt).toContain('Eu tenho 25 anos')
  const err = ex.commonErrors.find((c) => c.id === 'have-years')!
  expect(new RegExp(err.match).test('i have twenty five years')).toBe(true)
  expect(new RegExp(err.match).test('i am twenty five years old')).toBe(false)
})

test('every commonErrors regex rejects the accepted answers of its own exercise', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  for (const e of course.units.flatMap((u) => u.blocks.flatMap((b) => b.exercises)))
    if ('commonErrors' in e)
      for (const c of e.commonErrors)
        for (const a of e.accepted)
          expect(new RegExp(c.match).test(normalize(a)), `${e.id}/${c.id} matches "${a}"`).toBe(
            false
          )
})

test('accepted lists have no duplicates after stripping punctuation and case', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  const key = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9' ]/g, '')
      .trim()
  for (const e of course.units.flatMap((u) => u.blocks.flatMap((b) => b.exercises)))
    if ('accepted' in e) {
      const keys = e.accepted.map(key)
      expect(new Set(keys).size, `${e.id} has duplicate accepted`).toBe(keys.length)
    }
})

test('checkAnswer on content: a1-02-age-translate flags have-years, accepts correct forms', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  const ex = course.units[1].blocks
    .flatMap((b) => b.exercises)
    .find((e) => e.id === 'a1-02-age-translate')
  if (ex?.kind !== 'translate') throw new Error('a1-02-age-translate missing')
  const bad = checkAnswer('I have 25 years', ex)
  expect(bad.verdict).toBe('error')
  expect(bad.matchedError?.id).toBe('have-years')
  expect(checkAnswer("I'm 25 years old", ex).verdict).toBe('correct')
})

// A wildcard slot (*) needs a word to fill it.
const fillSlot = (a: string): string => a.replaceAll('*', 'London')

test('every accepted answer of every spoken/fill exercise is correct through checkAnswer', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  for (const e of course.units.flatMap((u) => u.blocks.flatMap((b) => b.exercises))) {
    if (e.kind === 'dialogue')
      for (const t of e.turns)
        if (t.speaker === 'you')
          for (const a of t.accepted)
            expect(checkAnswer(fillSlot(a), t).verdict, `${e.id} accepts "${a}"`).toBe('correct')
    if (
      e.kind === 'repeat' ||
      e.kind === 'translate' ||
      e.kind === 'listen_answer' ||
      e.kind === 'fill'
    )
      for (const a of e.accepted)
        expect(checkAnswer(fillSlot(a), e).verdict, `${e.id} accepts "${a}"`).toBe('correct')
  }
})

const assessmentExercises = (course: Awaited<ReturnType<typeof loadCourse>>): Exercise[] => [
  ...(course.placement?.levels ?? []).flatMap((l) => l.items.map((i) => i.exercise)),
  ...Object.values(course.exams ?? {}).flatMap((x) =>
    x.parts.flatMap((p) => p.items.map((i) => i.exercise))
  )
]

test('real course loads the placement (A1-C1) and the A1 exam', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  expect(course.placement?.levels.map((l) => l.level)).toEqual([...LEVELS])
  const exam = course.exams?.A1
  expect(exam?.minutes).toBe(25)
  expect(exam?.parts.map((p) => p.items.length)).toEqual([5, 5, 5, 5])
  for (const l of course.placement!.levels)
    expect(new Set(l.items.map((i) => i.exercise.kind)).size).toBeGreaterThanOrEqual(2)
  for (const e of assessmentExercises(course)) expect(e.id).toMatch(/^(pl|ex-(a1|a2|b1|b2|c1))-/)
})

test('assessments: accepted answers pass checkAnswer and no commonError rejects them', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  for (const e of assessmentExercises(course)) {
    if (
      e.kind === 'repeat' ||
      e.kind === 'translate' ||
      e.kind === 'listen_answer' ||
      e.kind === 'fill'
    )
      for (const a of e.accepted)
        expect(checkAnswer(fillSlot(a), e).verdict, `${e.id} accepts "${a}"`).toBe('correct')
    if ('commonErrors' in e)
      for (const c of e.commonErrors)
        for (const a of e.accepted)
          expect(new RegExp(c.match).test(normalize(a)), `${e.id}/${c.id} matches "${a}"`).toBe(
            false
          )
  }
})
