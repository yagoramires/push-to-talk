export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type Tokens = { tolist(): (number | bigint)[] }
type Pipe = {
  (audio: Float32Array): Promise<{ text: string } | { text: string }[]>
  processor(audio: Float32Array): Promise<{ input_features: unknown }>
  model: { generate(o: { inputs: unknown; decoder_input_ids: number[] }): Promise<Tokens[]> }
  tokenizer: {
    encode(text: string, o: { add_special_tokens: boolean }): number[]
    decode(ids: number[], o: { skip_special_tokens: boolean }): string
    convert_tokens_to_ids(tokens: string[]): number[]
  }
  dispose(): Promise<void>
}
export type Loaded = {
  run(audio: Float32Array, prompt?: string): Promise<string>
  dispose(): Promise<void>
}

export async function loadWhisper(repo: string): Promise<Loaded> {
  // ESM-only package: dynamic import also works from the CJS main bundle.
  const { pipeline } = await import('@huggingface/transformers')
  const p = (await pipeline('automatic-speech-recognition', repo, {
    dtype: 'q8'
  })) as unknown as Pipe
  const [prev, sot, noTs] = p.tokenizer.convert_tokens_to_ids([
    '<|startofprev|>',
    '<|startoftranscript|>',
    '<|notimestamps|>'
  ])
  return {
    async run(audio, prompt) {
      if (!prompt) {
        const out = await p(audio)
        return (Array.isArray(out) ? out[0] : out).text
      }
      // transformers.js has no prompt_ids for Whisper: build the same decoder prefix by hand
      // (<|startofprev|> prompt <|startoftranscript|> <|notimestamps|>); Whisper caps the prompt at 224 tokens.
      const text = p.tokenizer.encode(` ${prompt}`, { add_special_tokens: false }).slice(-200)
      const prefix = [prev, ...text, sot, noTs]
      const { input_features } = await p.processor(audio)
      const [ids] = await p.model.generate({ inputs: input_features, decoder_input_ids: prefix })
      return p.tokenizer.decode(ids.tolist().slice(prefix.length).map(Number), {
        skip_special_tokens: true
      })
    },
    dispose: () => p.dispose()
  }
}
