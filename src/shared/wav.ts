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
