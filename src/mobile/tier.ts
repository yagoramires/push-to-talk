import type { Hardware } from '../shared/api'
import { pronunciationEnabled } from '../shared/models'

// shortcut: 6 GB e rtf 1.5 são palpites; recalibrar com os logs do primeiro celular real.
export function chooseMobileSetup(
  hw: Hardware,
  rtf: number
): { pronunciation: boolean; llm: boolean } {
  return { pronunciation: pronunciationEnabled(rtf), llm: hw.totalMemGB >= 6 && rtf <= 1.5 }
}
