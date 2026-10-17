import { expect, test } from 'vitest'
import { ContentError, parseCourse, type CourseSource } from '../../src/shared/course-source'
import { makeCourse } from '../fixtures/course'

const memory = (files: Record<string, string>, withExists = false): CourseSource => ({
  unitFiles: async () =>
    Object.keys(files)
      .filter((p) => p.startsWith('units/'))
      .map((p) => p.slice('units/'.length)),
  read: async (path) => files[path],
  ...(withExists && { exists: async (path: string) => path in files })
})

const [unit] = makeCourse().units
const unitFiles = { 'units/a.json': JSON.stringify(unit) }

test('parses a minimal course from an in-memory source', async () => {
  const course = await parseCourse(memory(unitFiles))
  expect(course.units.map((u) => u.id)).toEqual([unit.id])
  expect(course.audio).toEqual({})
})

test('a listed unit that cannot be read is a ContentError naming the file', async () => {
  const src = { ...memory(unitFiles), unitFiles: async () => ['x.json'] }
  await expect(parseCourse(src)).rejects.toThrow(ContentError)
  await expect(parseCourse(src)).rejects.toThrow('units/x.json: missing')
})

test('without exists, an audio index pointing to a missing mp3 is not checked', async () => {
  const files = { ...unitFiles, 'audio/index.json': JSON.stringify({ hi: '0123456789abcdef.mp3' }) }
  await expect(parseCourse(memory(files))).resolves.toMatchObject({
    audio: { hi: '0123456789abcdef.mp3' }
  })
  await expect(parseCourse(memory(files, true))).rejects.toThrow('0123456789abcdef.mp3')
})
