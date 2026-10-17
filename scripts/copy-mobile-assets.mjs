import { cpSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'

const out = 'out/mobile'
// Capacitor's entry point must be index.html
renameSync(`${out}/mobile.html`, `${out}/index.html`)
cpSync('content', `${out}/content`, { recursive: true })
const units = readdirSync('content/units')
  .filter((f) => f.endsWith('.json'))
  .sort()
writeFileSync(`${out}/content/units/index.json`, JSON.stringify(units))
cpSync('resources/benchmark.wav', `${out}/benchmark.wav`)

const ort = 'node_modules/onnxruntime-web/dist'
mkdirSync(`${out}/ort`, { recursive: true })
for (const f of readdirSync(ort).filter((f) => /\.(wasm|mjs)$/.test(f)))
  cpSync(`${ort}/${f}`, `${out}/ort/${f}`)
