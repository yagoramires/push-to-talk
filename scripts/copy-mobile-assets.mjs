import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const out = 'out/mobile'
// Capacitor's entry point must be index.html
renameSync(`${out}/mobile.html`, `${out}/index.html`)
cpSync('content', `${out}/content`, { recursive: true })
const units = readdirSync('content/units')
  .filter((f) => f.endsWith('.json'))
  .sort()
writeFileSync(`${out}/content/units/index.json`, JSON.stringify(units))
cpSync('resources/benchmark.wav', `${out}/benchmark.wav`)

// The AI worker sets wasmPaths to /ort/ and the webgpu bundle loads only the asyncify build.
const ort = 'node_modules/onnxruntime-web/dist'
mkdirSync(`${out}/ort`, { recursive: true })
for (const f of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'])
  cpSync(`${ort}/${f}`, `${out}/ort/${f}`)
// Vite also emits the wasm next to the worker (the bundle's new URL default); unused with wasmPaths set.
for (const f of readdirSync(`${out}/assets`).filter((f) => /^ort-wasm.*\.wasm$/.test(f)))
  rmSync(`${out}/assets/${f}`)
