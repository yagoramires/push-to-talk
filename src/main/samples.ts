import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Sample, Settings } from '../shared/api'

/**
 * Opt-in voice samples (off by default: the app is shared between learners).
 * <dir>/settings.json holds the switch; <dir>/amostras/ holds <timestamp>-<exerciseId>.wav + amostras.jsonl.
 */
export function createSamples(dir: string): {
  getSettings(): Promise<Settings>
  setSaveSamples(on: boolean): Promise<void>
  save(s: Sample): Promise<void>
  remove(): Promise<void>
  dir: string
} {
  const settingsFile = join(dir, 'settings.json')
  const samplesDir = join(dir, 'amostras')
  const getSettings = async (): Promise<Settings> => {
    try {
      const raw = JSON.parse(await readFile(settingsFile, 'utf8')) as Partial<Settings>
      return { saveSamples: raw.saveSamples === true }
    } catch {
      return { saveSamples: false } // missing or corrupt: stay off
    }
  }
  return {
    dir: samplesDir,
    getSettings,
    async setSaveSamples(on) {
      await writeFile(settingsFile, JSON.stringify({ saveSamples: on === true }, null, 2))
    },
    async save({ exerciseId, mode, wav, expected, hint, transcript, verdict }) {
      if (!(await getSettings()).saveSamples) return
      const at = new Date().toISOString()
      // exerciseId comes from the renderer: keep it a plain file name.
      const file = `${at.replace(/[:.]/g, '-')}-${exerciseId.replace(/[^\w#-]/g, '_')}.wav`
      await mkdir(samplesDir, { recursive: true })
      await writeFile(join(samplesDir, file), wav)
      const line = { at, exerciseId, mode, expected, hint, transcript, verdict, wav: file }
      await appendFile(join(samplesDir, 'amostras.jsonl'), JSON.stringify(line) + '\n')
    },
    remove: () => rm(samplesDir, { recursive: true, force: true })
  }
}
