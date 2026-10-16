import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadCourse } from '../../src/main/content/load-course'
import { BLOCK_KINDS, LEVELS, SPOKEN_KINDS, type Exercise } from '../../src/shared/content'
import { listenTexts } from '../../src/shared/listen'

const course = loadCourse(join(__dirname, '../../content'))
const exercisesOf = (u: { blocks: { exercises: Exercise[] }[] }): Exercise[] =>
  u.blocks.flatMap((b) => b.exercises)

// Levels without units are skipped until their content task lands.
test.each(LEVELS)('%s: units numbered 1..n (at most 12) and an exam', async (level) => {
  const c = await course
  const units = c.units.filter((u) => u.level === level)
  if (!units.length) return
  // <= 12 while A1 is being written; Task 2 makes it exactly 12.
  expect(units.length).toBeLessThanOrEqual(12)
  expect(units.map((u) => u.order)).toEqual(units.map((_, i) => i + 1))
  expect(c.exams?.[level], `exam-${level.toLowerCase()}.json`).toBeDefined()
})

test('every unit has the 6 blocks in order, ends conversation with free_speak, is half spoken', async () => {
  for (const u of (await course).units) {
    expect(
      u.blocks.map((b) => b.kind),
      u.id
    ).toEqual([...BLOCK_KINDS])
    expect(u.blocks[4].exercises.at(-1)?.kind, u.id).toBe('free_speak')
    const ex = exercisesOf(u)
    const spoken = ex.filter((e) => (SPOKEN_KINDS as readonly string[]).includes(e.kind))
    expect(spoken.length * 2, u.id).toBeGreaterThanOrEqual(ex.length)
  }
})

test('every translate and listen_answer has a common error', async () => {
  const c = await course
  const all = [
    ...c.units.flatMap(exercisesOf),
    ...(c.placement?.levels ?? []).flatMap((l) => l.items.map((i) => i.exercise)),
    ...Object.values(c.exams ?? {}).flatMap((x) =>
      x.parts.flatMap((p) => p.items.map((i) => i.exercise))
    )
  ]
  const missing = all.filter(
    (e) => (e.kind === 'translate' || e.kind === 'listen_answer') && !e.commonErrors.length
  )
  expect(missing.map((e) => e.id)).toEqual([])
})

test('every listened text has bundled audio (run npm run audio)', async () => {
  const c = await course
  const texts = [
    ...c.units.flatMap(exercisesOf),
    ...(c.placement?.levels ?? []).flatMap((l) => l.items),
    ...Object.values(c.exams ?? {}).flatMap((x) => x.parts.flatMap((p) => p.items))
  ].flatMap(listenTexts)
  expect(texts.filter((t) => !c.audio[t])).toEqual([])
})
