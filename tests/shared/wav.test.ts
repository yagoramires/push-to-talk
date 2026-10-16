import { expect, test } from 'vitest'
import { decodeWav, encodeWav } from '../../src/shared/wav'

test('encodeWav writes a valid 16-bit mono header and clips', () => {
  const b = encodeWav(new Float32Array([0, 1, -1, 2]), 16000)
  const v = new DataView(b.buffer)
  expect(new TextDecoder().decode(b.slice(0, 4))).toBe('RIFF')
  expect(new TextDecoder().decode(b.slice(8, 12))).toBe('WAVE')
  expect(v.getUint32(24, true)).toBe(16000)
  expect(v.getUint16(34, true)).toBe(16)
  expect(v.getUint32(40, true)).toBe(8)
  expect(v.getInt16(46, true)).toBe(32767)
  expect(v.getInt16(48, true)).toBe(-32768)
  expect(v.getInt16(50, true)).toBe(32767)
})

test('decodeWav round-trips encodeWav within 1/32768', () => {
  const x = new Float32Array([0, 0.5, -0.5, 0.999, -1])
  const r = decodeWav(encodeWav(x, 16000))
  expect(r.sampleRate).toBe(16000)
  expect(r.samples).toHaveLength(x.length)
  x.forEach((s, i) => expect(Math.abs(r.samples[i] - s)).toBeLessThanOrEqual(1 / 32768))
})

test('decodeWav rejects non-RIFF and non-PCM16-mono input', () => {
  expect(() => decodeWav(new Uint8Array(64))).toThrow(/RIFF/)
  const stereo = encodeWav(new Float32Array(4), 16000)
  new DataView(stereo.buffer).setUint16(22, 2, true)
  expect(() => decodeWav(stereo)).toThrow(/mono/)
})
