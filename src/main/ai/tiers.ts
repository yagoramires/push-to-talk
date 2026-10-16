import type { Hardware, Tier } from '../../shared/api'

export { LLM_BY_TIER, type ModelFile } from '../../shared/models'

export const STT_MODEL = 'onnx-community/whisper-base.en'
export const PRON_MODEL = 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX'

/** RAM reportada vem ~0.1-0.4 GB abaixo do nominal (reserva da iGPU/firmware): arredonda para o GB inteiro */
export const toGB = (bytes: number): number => Math.round(bytes / 1024 ** 3)

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
