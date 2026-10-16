/** PCM16 mono WAV; samples outside [-1, 1] are clipped. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2
  const out = new Uint8Array(44 + dataLen)
  const v = new DataView(out.buffer)
  const tag = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i))
  }
  tag(0, 'RIFF')
  v.setUint32(4, 36 + dataLen, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  tag(36, 'data')
  v.setUint32(40, dataLen, true)
  samples.forEach((s, i) => {
    const c = Math.max(-1, Math.min(1, s))
    v.setInt16(44 + i * 2, c < 0 ? c * 0x8000 : c * 0x7fff, true)
  })
  return out
}

/** Inverse of encodeWav: PCM16 mono only (what the recorder produces). */
export function decodeWav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (off: number): string => String.fromCharCode(...bytes.slice(off, off + 4))
  if (bytes.length < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE')
    throw new Error('Not a RIFF/WAVE file')
  if (v.getUint16(20, true) !== 1 || v.getUint16(34, true) !== 16 || v.getUint16(22, true) !== 1) {
    throw new Error('Unsupported WAV: expected PCM16 mono')
  }
  // walk chunks: ffmpeg-made files carry a LIST chunk before "data"
  let off = 12
  while (off + 8 <= bytes.length && tag(off) !== 'data')
    off += 8 + v.getUint32(off + 4, true) + (v.getUint32(off + 4, true) & 1)
  if (off + 8 > bytes.length) throw new Error('Unsupported WAV: no data chunk')
  const start = off + 8
  const n = Math.min(v.getUint32(off + 4, true), bytes.length - start) >> 1
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const s = v.getInt16(start + i * 2, true)
    samples[i] = s < 0 ? s / 0x8000 : s / 0x7fff
  }
  return { samples, sampleRate: v.getUint32(24, true) }
}
