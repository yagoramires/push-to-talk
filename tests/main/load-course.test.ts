import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { ContentError, loadCourse } from '../../src/main/content/load-course'
import { makeCourse } from '../fixtures/course'

async function dirWith(
  files: Record<string, unknown>,
  assessments: Record<string, unknown> = {}
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'course-'))
  await mkdir(join(dir, 'units'))
  for (const [name, data] of Object.entries(files))
    await writeFile(
      join(dir, 'units', name),
      typeof data === 'string' ? data : JSON.stringify(data)
    )
  if (Object.keys(assessments).length) await mkdir(join(dir, 'assessments'))
  for (const [name, data] of Object.entries(assessments))
    await writeFile(join(dir, 'assessments', name), JSON.stringify(data))
  return dir
}

test('loads, validates and sorts units by level then order', async () => {
  const [u1, u2] = makeCourse().units
  const dir = await dirWith({
    'b.json': { ...u2, id: 'x2', order: 2 },
    'a.json': { ...u1, id: 'x1', order: 1 }
  })
  const course = await loadCourse(dir)
  expect(course.units.map((u) => u.id)).toEqual(['x1', 'x2'])
})

test('throws ContentError naming the file on invalid unit', async () => {
  const dir = await dirWith({ 'bad.json': { id: 'nope' } })
  await expect(loadCourse(dir)).rejects.toThrow(/bad\.json/)
  await expect(loadCourse(dir)).rejects.toBeInstanceOf(ContentError)
})

test('ContentError message carries the zod issue path', async () => {
  const u = structuredClone(makeCourse().units[0])
  u.blocks[0].minutes = 99
  const dir = await dirWith({ 'bad.json': u })
  const err = await loadCourse(dir).catch((e) => e)
  expect(err).toBeInstanceOf(ContentError)
  expect(err.message).toMatch(/bad\.json/)
  expect(err.message).toMatch(/blocks\.0\.minutes/)
})

test('throws ContentError naming the file on malformed JSON', async () => {
  const dir = await dirWith({ 'broken.json': '{' })
  await expect(loadCourse(dir)).rejects.toThrow(/broken\.json/)
})

test('throws ContentError on duplicate exercise id across units', async () => {
  const [u1, u2] = makeCourse().units
  // same exercise ids in both units, different unit/block ids
  const clone = structuredClone(u2)
  clone.blocks.forEach((b, i) => {
    b.id = `y-${i}`
    b.exercises = structuredClone(u1.blocks[i].exercises)
  })
  const dir = await dirWith({ 'a.json': u1, 'b.json': clone })
  await expect(loadCourse(dir)).rejects.toThrow(/duplicate/i)
  await expect(loadCourse(dir)).rejects.toBeInstanceOf(ContentError)
})

test('throws ContentError on duplicate unit id', async () => {
  const [u1] = makeCourse().units
  const dir = await dirWith({ 'a.json': u1, 'b.json': u1 })
  await expect(loadCourse(dir)).rejects.toThrow(/duplicate/i)
})

test('loads placement and level exams from assessments/', async () => {
  const c = makeCourse()
  const dir = await dirWith(
    { 'a.json': c.units[0], 'b.json': c.units[1] },
    { 'placement.json': c.placement, 'exam-a1.json': c.exams!.A1 }
  )
  const course = await loadCourse(dir)
  expect(course.placement).toEqual(c.placement)
  expect(course.exams).toEqual({ A1: c.exams!.A1 })
})

test('assessments are optional', async () => {
  const course = await loadCourse(await dirWith({ 'a.json': makeCourse().units[0] }))
  expect(course.placement).toBeUndefined()
  expect(course.exams).toBeUndefined()
})

test('rejects an unknown unitId, naming the file', async () => {
  const c = makeCourse()
  const exam = structuredClone(c.exams!.A1!)
  exam.parts[0].items[0].unitId = 'nope'
  const dir = await dirWith({ 'a.json': c.units[0] }, { 'exam-a1.json': exam })
  const err = await loadCourse(dir).catch((e) => e)
  expect(err).toBeInstanceOf(ContentError)
  expect(err.message).toMatch(/exam-a1\.json/)
  expect(err.message).toMatch(/nope/)
})

test('rejects an exercise id shared by a unit and an exam', async () => {
  const c = makeCourse()
  const exam = structuredClone(c.exams!.A1!)
  exam.parts[0].items[0].exercise.id = 'u1-warmup-ex'
  const dir = await dirWith({ 'a.json': c.units[0] }, { 'exam-a1.json': exam })
  await expect(loadCourse(dir)).rejects.toThrow(/exam-a1\.json: duplicate id "u1-warmup-ex"/)
})

test('rejects an invalid assessment file, naming it', async () => {
  const c = makeCourse()
  const dir = await dirWith({ 'a.json': c.units[0] }, { 'placement.json': { levels: [] } })
  await expect(loadCourse(dir)).rejects.toThrow(/placement\.json/)
})
