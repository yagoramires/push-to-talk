import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ContentError, parseCourse, type CourseSource } from '../../shared/course-source'
import type { Course } from '../../shared/content'

export { ContentError }

const fsSource = (dir: string): CourseSource => ({
  unitFiles: () => readdir(join(dir, 'units')),
  read: (path) =>
    readFile(join(dir, path), 'utf8').catch((e) => {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw e
    }),
  exists: (path) =>
    access(join(dir, path)).then(
      () => true,
      () => false
    )
})

export const loadCourse = (dir: string): Promise<Course> => parseCourse(fsSource(dir))
