import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { loadCourse } from '../../src/main/content/load-course'
import { makeCourse } from '../fixtures/course'

async function dirWith(files: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'course-'))
  await mkdir(join(dir, 'units'))
  for (const [name, data] of Object.entries(files))
    await writeFile(
      join(dir, 'units', name),
      typeof data === 'string' ? data : JSON.stringify(data)
    )
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
})

test('throws ContentError on duplicate unit id', async () => {
  const [u1] = makeCourse().units
  const dir = await dirWith({ 'a.json': u1, 'b.json': u1 })
  await expect(loadCourse(dir)).rejects.toThrow(/duplicate/i)
})
