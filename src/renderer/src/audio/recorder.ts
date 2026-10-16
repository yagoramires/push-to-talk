export type Recorder = { stop(): Promise<Float32Array> }

export const SAMPLE_RATE = 16000

/** 16 kHz mono capture; auto-stops after maxSeconds. Releases the mic on stop. */
export async function startRecording(maxSeconds = 30): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
  const source = ctx.createMediaStreamSource(stream)
  // shortcut: ScriptProcessorNode is deprecated but avoids CSP issues; switch to AudioWorklet if Chromium drops it.
  const node = ctx.createScriptProcessor(4096, 1, 1)
  const chunks: Float32Array[] = []
  node.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }
  source.connect(node)
  node.connect(ctx.destination)

  let result: Promise<Float32Array> | null = null
  const stop = (): Promise<Float32Array> =>
    (result ??= (async () => {
      clearTimeout(timer)
      node.disconnect()
      source.disconnect()
      node.onaudioprocess = null
      stream.getTracks().forEach((t) => t.stop())
      await ctx.close()
      const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
      let off = 0
      for (const c of chunks) {
        out.set(c, off)
        off += c.length
      }
      return out
    })())
  const timer = setTimeout(() => void stop(), maxSeconds * 1000)
  return { stop }
}
