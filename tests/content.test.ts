import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadCourse } from '../src/main/content/load-course'
import { BLOCK_KINDS, SPOKEN_KINDS } from '../src/shared/content'

test('all units in content/ are valid', async () => {
  const course = await loadCourse(join(__dirname, '..', 'content'))
  expect(course.units.map((u) => u.id)).toEqual(['a1-01-greetings', 'a1-02-numbers-age'])
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
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/-/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
  for (const e of course.units.flatMap((u) => u.blocks.flatMap((b) => b.exercises)))
    if ('commonErrors' in e)
      for (const c of e.commonErrors)
        for (const a of e.accepted)
          expect(new RegExp(c.match).test(norm(a)), `${e.id}/${c.id} matches "${a}"`).toBe(false)
})
