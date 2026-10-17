import type { Hardware, Tier } from '../../shared/api'

export {
  LLM_BY_TIER,
  STT_BY_TIER,
  STT_BASE as STT_MODEL,
  pronunciationEnabled,
  PRON_MODEL,
  toGB,
  type ModelFile
} from '../../shared/models'

/** rtf null = sem benchmark ainda, tratado como 1.0 */
export function chooseTier(hw: Hardware, rtf: number | null): Tier {
  if (hw.platform === 'darwin' && hw.arch === 'arm64') {
    return hw.totalMemGB >= 16 ? 'strong' : 'medium'
  }
  if (hw.totalMemGB < 12) return 'light'
  if (hw.totalMemGB >= 16 && ((rtf ?? 1) <= 0.6 || hw.hasDiscreteGpu)) return 'medium'
  return 'light'
}
