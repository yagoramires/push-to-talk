import type { Tier } from './api'

export type ModelFile = { repo: string; file: string; bytes: number }

// Hugging Face sizes are decimal MB (e.g. 2B file = 1_280_835_840 bytes); setup checks bytes ±1%.
const MB = 1_000_000
export const LLM_BY_TIER: Record<Tier, ModelFile> = {
  light: { repo: 'unsloth/Qwen3.5-2B-GGUF', file: 'Qwen3.5-2B-Q4_K_M.gguf', bytes: 1281 * MB },
  medium: { repo: 'unsloth/Qwen3.5-4B-GGUF', file: 'Qwen3.5-4B-Q4_K_M.gguf', bytes: 2741 * MB },
  strong: { repo: 'unsloth/Qwen3.5-9B-GGUF', file: 'Qwen3.5-9B-Q4_K_M.gguf', bytes: 5681 * MB }
}
const STT_BYTES = 77 * MB
const PRON_BYTES = 318 * MB

/** Everything a tier downloads: speech recognition + pronunciation + the text model. */
export const downloadBytes = (tier: Tier): number =>
  STT_BYTES + PRON_BYTES + LLM_BY_TIER[tier].bytes
