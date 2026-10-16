import type { Hardware, Tier } from '../../shared/api'

export type ModelFile = { repo: string; file: string; bytes: number }

export const STT_MODEL = 'onnx-community/whisper-base.en'
export const PRON_MODEL = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX'

const MB = 1024 * 1024
export const LLM_BY_TIER: Record<Tier, ModelFile> = {
  light: { repo: 'unsloth/Qwen3.5-2B-GGUF', file: 'Qwen3.5-2B-Q4_K_M.gguf', bytes: 1281 * MB },
  medium: { repo: 'unsloth/Qwen3.5-4B-GGUF', file: 'Qwen3.5-4B-Q4_K_M.gguf', bytes: 2741 * MB },
  strong: { repo: 'unsloth/Qwen3.5-9B-GGUF', file: 'Qwen3.5-9B-Q4_K_M.gguf', bytes: 5681 * MB }
}

/** rtf null = sem benchmark ainda, tratado como 1.0 */
export function chooseTier(hw: Hardware, rtf: number | null): Tier {
  if (hw.platform === 'darwin' && hw.arch === 'arm64') {
    return hw.totalMemGB >= 16 ? 'strong' : 'medium'
  }
  if (hw.totalMemGB < 12) return 'light'
  if (hw.totalMemGB >= 16 && ((rtf ?? 1) <= 0.6 || hw.hasDiscreteGpu)) return 'medium'
  return 'light'
}

export function pronunciationEnabled(rtf: number | null): boolean {
  return rtf === null || rtf <= 1.0
}
