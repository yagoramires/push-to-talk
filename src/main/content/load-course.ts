import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import {
  LEVELS,
  LevelExamSchema,
  PlacementSchema,
  UnitSchema,
  type AssessmentItem,
  type Course,
  type Level,
  type LevelExam,
  type Unit
} from '../../shared/content'

export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

/** Lê e valida um JSON; erros saem como ContentError com o nome do arquivo. undefined se não existir e for opcional. */
async function parseFile<T>(
  path: string,
  file: string,
  schema: z.ZodType<T>,
  optional = false
): Promise<T | undefined> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(path, 'utf8'))
  } catch (e) {
    if (optional && (e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new ContentError(`${file}: invalid JSON (${(e as Error).message})`)
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new ContentError(`${file}: ${issues}`)
  }
  return parsed.data
}

export async function loadCourse(dir: string): Promise<Course> {
  const files = (await readdir(join(dir, 'units'))).filter((f) => f.endsWith('.json')).sort()
  const units: Unit[] = []
  const seen = new Map<string, string>() // id -> arquivo que o declarou
  const claim = (ids: string[], file: string): void => {
    for (const id of ids) {
      const prev = seen.get(id)
      if (prev) throw new ContentError(`${file}: duplicate id "${id}" (already used in ${prev})`)
      seen.set(id, file)
    }
  }
  for (const file of files) {
    const unit = (await parseFile(join(dir, 'units', file), file, UnitSchema))!
    claim(
      [
        unit.id,
        ...unit.blocks.flatMap((b) => [b.id, ...b.exercises.map((e) => e.id)]),
        ...unit.practice.map((e) => e.id)
      ],
      file
    )
    units.push(unit)
  }
  units.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.order - b.order)

  const assessment = async <T>(
    name: string,
    schema: z.ZodType<T>,
    itemsOf: (d: T) => AssessmentItem[]
  ): Promise<T | undefined> => {
    const file = `assessments/${name}`
    const data = await parseFile(join(dir, 'assessments', name), file, schema, true)
    if (!data) return undefined
    const items = itemsOf(data)
    claim(
      items.map((i) => i.exercise.id),
      file
    )
    const missing = items.find((i) => i.unitId && !units.some((u) => u.id === i.unitId))
    if (missing) throw new ContentError(`${file}: unknown unitId "${missing.unitId}"`)
    return data
  }

  const placement = await assessment('placement.json', PlacementSchema, (p) =>
    p.levels.flatMap((l) => l.items)
  )
  const exams: Partial<Record<Level, LevelExam>> = {}
  for (const level of LEVELS) {
    const name = `exam-${level.toLowerCase()}.json`
    const exam = await assessment(name, LevelExamSchema, (x) => x.parts.flatMap((p) => p.items))
    if (!exam) continue
    if (exam.level !== level)
      throw new ContentError(`assessments/${name}: level "${exam.level}" does not match file name`)
    exams[level] = exam
  }
  const audio =
    (await parseFile(
      join(dir, 'audio', 'index.json'),
      'audio/index.json',
      z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{16}\.mp3$/)),
      true
    )) ?? {}
  for (const file of Object.values(audio))
    await access(join(dir, 'audio', file)).catch(() => {
      throw new ContentError(`audio/index.json: missing file "${file}"`)
    })
  const course: Course = { units, audio }
  if (placement) course.placement = placement
  if (Object.keys(exams).length) course.exams = exams
  return course
}
