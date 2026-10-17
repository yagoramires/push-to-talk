import type { AppState, LoadResult } from '../shared/api'
import { emptyState, isState } from '../shared/state'
import type { TextFs } from './fs'

// Same semantics as src/main/store.ts, on top of TextFs.
export function createMobileStore(fs: TextFs): {
  load(): Promise<LoadResult>
  save(state: AppState): Promise<void>
} {
  const file = 'state.json'
  let queue: Promise<void> = Promise.resolve()

  return {
    async load() {
      const raw = await fs.read(file)
      if (raw === undefined) return { state: emptyState() }
      try {
        const parsed: unknown = JSON.parse(raw)
        if (isState(parsed)) return { state: parsed }
      } catch {
        // invalid JSON: fall through to backup
      }
      const backup = `state.corrupt-${Date.now()}.json`
      await fs.rename(file, backup)
      return { state: emptyState(), recoveredFrom: backup }
    },
    save(state) {
      const run = async (): Promise<void> => {
        await fs.write(`${file}.tmp`, JSON.stringify(state, null, 2))
        await fs.rename(`${file}.tmp`, file)
      }
      const p = queue.then(run)
      queue = p.catch(() => {})
      return p
    }
  }
}
