import type { Hardware } from '../shared/api'
import { pronunciationEnabled } from '../shared/models'

// Phone rule: pronunciation when the benchmark is fast enough; the LLM only with enough RAM (>= 8 GB).
export function chooseMobileSetup(
  hw: Hardware,
  rtf: number
): { pronunciation: boolean; llm: boolean } {
  return { pronunciation: pronunciationEnabled(rtf), llm: hw.totalMemGB >= 8 }
}
