// npm run audio: generates content/audio/<hash>.mp3 for every listened text (only the missing ones),
// drops the ones no exercise uses anymore and rewrites content/audio/index.json (text → file).
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { audioFile } from '../src/main/content/audio-file.ts'
import { listenTexts } from '../src/shared/listen.ts'

const content = join(import.meta.dirname, '../content')
const audioDir = join(content, 'audio')
const indexPath = join(audioDir, 'index.json')

const [units, assessments] = await Promise.all(
  ['units', 'assessments'].map(async (dir) => {
    const files = (await readdir(join(content, dir))).filter((f) => f.endsWith('.json'))
    return Promise.all(
      files.map(async (f) => JSON.parse(await readFile(join(content, dir, f), 'utf8')))
    )
  })
)
const texts = new Set(
  [
    ...units.flatMap((u) => [...u.blocks.flatMap((b) => b.exercises), ...(u.practice ?? [])]),
    // placement.json has levels[].items, exam-*.json has parts[].items
    ...assessments.flatMap((a) => (a.levels ?? a.parts).flatMap((x) => x.items))
  ].flatMap(listenTexts)
)

await mkdir(audioDir, { recursive: true })
const onDisk = new Set((await readdir(audioDir)).filter((f) => f.endsWith('.mp3')))
const missing = [...texts].filter((t) => !onDisk.has(audioFile(t)))

if (missing.length) {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error('instale o ffmpeg (brew install ffmpeg)')
  }
  const { KokoroTTS } = await import('kokoro-js')
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: 'q8'
  })
  const wav = join(tmpdir(), 'generate-audio.wav')
  for (const [i, text] of missing.entries()) {
    const file = audioFile(text)
    await (await tts.generate(text, { voice: 'af_heart' })).save(wav)
    execFileSync('ffmpeg', [
      ...['-y', '-loglevel', 'error', '-i', wav],
      ...['-ac', '1', '-b:a', '48k', join(audioDir, file)]
    ])
    console.log(`${i + 1}/${missing.length} ${file} ${text}`)
  }
  await rm(wav, { force: true })
}

const index = Object.fromEntries([...texts].sort().map((t) => [t, audioFile(t)]))
const used = new Set(Object.values(index))
const unused = [...onDisk].filter((f) => !used.has(f))
for (const f of unused) await rm(join(audioDir, f))
await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n')
console.log(`${texts.size} textos, ${missing.length} gerados, ${unused.length} removidos`)
