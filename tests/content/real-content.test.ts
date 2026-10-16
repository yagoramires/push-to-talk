import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadCourse } from '../../src/main/content/load-course'
import {
  BLOCK_KINDS,
  LEVELS,
  SPOKEN_KINDS,
  type Exercise,
  type Unit
} from '../../src/shared/content'
import { listenTexts } from '../../src/shared/listen'

const course = loadCourse(join(__dirname, '../../content'))
const exercisesOf = (u: { blocks: { exercises: Exercise[] }[] }): Exercise[] =>
  u.blocks.flatMap((b) => b.exercises)
const withPractice = (u: Unit): Exercise[] => [...exercisesOf(u), ...u.practice]

test.each(LEVELS)('%s: units numbered 1..12 and an exam', async (level) => {
  const c = await course
  const units = c.units.filter((u) => u.level === level)
  expect(units.map((u) => u.order)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
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

test('every translate, listen_answer and dialogue "you" turn has a common error', async () => {
  const c = await course
  const all = [
    ...c.units.flatMap(withPractice),
    ...(c.placement?.levels ?? []).flatMap((l) => l.items.map((i) => i.exercise)),
    ...Object.values(c.exams ?? {}).flatMap((x) =>
      x.parts.flatMap((p) => p.items.map((i) => i.exercise))
    )
  ]
  const missing = all.flatMap((e) =>
    e.kind === 'dialogue'
      ? e.turns.flatMap((t, i) =>
          t.speaker === 'you' && !t.commonErrors.length ? [`${e.id} turn ${i}`] : []
        )
      : (e.kind === 'translate' || e.kind === 'listen_answer') && !e.commonErrors.length
        ? [e.id]
        : []
  )
  expect(missing).toEqual([])
})

test('every listened text has bundled audio (run npm run audio)', async () => {
  const c = await course
  const texts = [
    ...c.units.flatMap(withPractice),
    ...(c.placement?.levels ?? []).flatMap((l) => l.items),
    ...Object.values(c.exams ?? {}).flatMap((x) => x.parts.flatMap((p) => p.items))
  ].flatMap(listenTexts)
  expect(texts.filter((t) => !c.audio[t])).toEqual([])
})

// Task 4 fills `practice` and the dialogues; until then an empty bank passes and Task 4 tightens it.
test('practice bank: empty or 24..32 items, at least 60% spoken', async () => {
  for (const u of (await course).units) {
    const n = u.practice.length
    if (!n) continue
    expect(n, u.id).toBeGreaterThanOrEqual(24)
    expect(n, u.id).toBeLessThanOrEqual(32)
    const spoken = u.practice.filter((e) => (SPOKEN_KINDS as readonly string[]).includes(e.kind))
    expect(spoken.length, u.id).toBeGreaterThanOrEqual(0.6 * n)
  }
})

test('every dialogue (blocks or practice) has 3..6 "you" turns', async () => {
  const bad = (await course).units.flatMap(withPractice).flatMap((e) => {
    const you = e.kind === 'dialogue' ? e.turns.filter((t) => t.speaker === 'you').length : 3
    return you < 3 || you > 6 ? [e.id] : []
  })
  expect(bad).toEqual([])
})
