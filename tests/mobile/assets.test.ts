import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe.skipIf(!existsSync('out/mobile'))('mobile bundle', () => {
  it('ships the onnx runtime wasm', () => {
    expect(readdirSync('out/mobile/ort').some((f) => f.endsWith('.wasm'))).toBe(true)
  })

  it('lists the 60 units', () => {
    const units = JSON.parse(readFileSync('out/mobile/content/units/index.json', 'utf8'))
    expect(units).toHaveLength(60)
  })
})
