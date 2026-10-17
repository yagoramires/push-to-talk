import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppState, LoadResult } from '../shared/api'
import { emptyState, isState } from '../shared/state'

export function createStore(dir: string): {
  load(): Promise<LoadResult>
  save(state: AppState): Promise<void>
} {
  const file = join(dir, 'state.json')
  let queue: Promise<void> = Promise.resolve()

  return {
    async load() {
      let raw: string
      try {
        raw = await readFile(file, 'utf8')
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { state: emptyState() }
        throw e
      }
      try {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed)) return { state: parsed }
      } catch {
        // invalid JSON: fall through to backup
      }
      const backup = join(dir, `state.corrupt-${Date.now()}.json`)
      await rename(file, backup)
      return { state: emptyState(), recoveredFrom: backup }
    },
    // Writes are chained so they never overlap; a failed write doesn't poison the queue.
    save(state) {
      const run = async (): Promise<void> => {
        const tmp = `${file}.tmp`
        await writeFile(tmp, JSON.stringify(state, null, 2))
        await rename(tmp, file)
      }
      const p = queue.then(run)
      queue = p.catch(() => {})
      return p
    }
  }
}
