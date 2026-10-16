import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodeWav } from '../shared/wav'
import { loadCourse } from './content/load-course'

/** Where the course and benchmark clip live: extraResources when packaged, the repo in dev. */
export function resourcePaths(o: { packaged: boolean; resourcesPath: string; appPath: string }): {
  content: string
  benchmarkWav: string
} {
  return o.packaged
    ? {
        content: join(o.resourcesPath, 'content'),
        benchmarkWav: join(o.resourcesPath, 'benchmark.wav')
      }
    : {
        content: join(o.appPath, 'content'),
        benchmarkWav: join(o.appPath, 'resources/benchmark.wav')
      }
}

const MODULES = ['@huggingface/transformers', 'node-llama-cpp', 'phonemizer', 'sharp']

/** Package smoke test: every step runs, each one reports `OK <step>` or `FALHOU <step>: <message>`. */
export async function selfCheck(o: {
  content: string
  benchmarkWav: string
  importModule?: (name: string) => Promise<unknown>
}): Promise<{ ok: boolean; lines: string[] }> {
  const importModule = o.importModule ?? ((n: string) => import(n))
  const lines: string[] = []
  let ok = true
  const step = async (name: string, run: () => Promise<unknown>): Promise<void> => {
    try {
      await run()
      lines.push(`OK ${name}`)
    } catch (e) {
      ok = false
      lines.push(`FALHOU ${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await step(`curso (${o.content})`, () => loadCourse(o.content))
  await step(`benchmark.wav (${o.benchmarkWav})`, async () =>
    decodeWav(new Uint8Array(await readFile(o.benchmarkWav)))
  )
  for (const name of MODULES) await step(name, () => importModule(name))
  return { ok, lines }
}
