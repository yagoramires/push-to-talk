import type { Sample, Settings } from '../shared/api'
import { sampleEntry } from '../shared/samples'
import type { TextFs } from './fs'

// Opt-in voice samples, same layout as src/main/samples.ts (settings.json + amostras/).
export function createMobileSamples(fs: TextFs): {
  getSettings(): Promise<Settings>
  setSaveSamples(on: boolean): Promise<void>
  save(s: Sample): Promise<void>
  remove(): Promise<void>
} {
  const getSettings = async (): Promise<Settings> => {
    try {
      const raw = JSON.parse((await fs.read('settings.json')) ?? '') as Partial<Settings>
      return { saveSamples: raw.saveSamples === true }
    } catch {
      return { saveSamples: false } // missing or corrupt: stay off
    }
  }
  return {
    getSettings,
    setSaveSamples: (on) =>
      fs.write('settings.json', JSON.stringify({ saveSamples: on === true }, null, 2)),
    async save(s) {
      if (!(await getSettings()).saveSamples) return
      const { file, line } = sampleEntry(s, new Date())
      await fs.writeBytes(`amostras/${file}`, s.wav)
      await fs.append('amostras/amostras.jsonl', JSON.stringify(line) + '\n')
    },
    remove: () => fs.remove('amostras')
  }
}
