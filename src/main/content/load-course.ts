import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { LEVELS, UnitSchema, type Course, type Unit } from '../../shared/content'

export class ContentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentError'
  }
}

export async function loadCourse(dir: string): Promise<Course> {
  const files = (await readdir(join(dir, 'units'))).filter((f) => f.endsWith('.json')).sort()
  const units: Unit[] = []
  const seen = new Map<string, string>() // id -> arquivo que o declarou
  for (const file of files) {
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(join(dir, 'units', file), 'utf8'))
    } catch (e) {
      throw new ContentError(`${file}: invalid JSON (${(e as Error).message})`)
    }
    const parsed = UnitSchema.safeParse(raw)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')
      throw new ContentError(`${file}: ${issues}`)
    }
    const unit = parsed.data
    const ids = [unit.id, ...unit.blocks.flatMap((b) => [b.id, ...b.exercises.map((e) => e.id)])]
    for (const id of ids) {
      const prev = seen.get(id)
      if (prev) throw new ContentError(`${file}: duplicate id "${id}" (already used in ${prev})`)
      seen.set(id, file)
    }
    units.push(unit)
  }
  units.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.order - b.order)
  return { units }
}
