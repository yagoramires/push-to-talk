import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Sample, Settings } from '../shared/api'
import { sampleEntry } from '../shared/samples'

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
    async save(s) {
      if (!(await getSettings()).saveSamples) return
      const { file, line } = sampleEntry(s, new Date())
      await mkdir(samplesDir, { recursive: true })
      await writeFile(join(samplesDir, file), s.wav)
      await appendFile(join(samplesDir, 'amostras.jsonl'), JSON.stringify(line) + '\n')
    },
    remove: () => rm(samplesDir, { recursive: true, force: true })
  }
}
