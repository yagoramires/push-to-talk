import type { Hardware } from '../shared/api'
import { pronunciationEnabled } from '../shared/models'

// shortcut: 6 GB e rtf 1.5 são palpites; recalibrar com os logs do primeiro celular real.
export function chooseMobileSetup(
  hw: Hardware,
  rtf: number
): { pronunciation: boolean; llm: boolean } {
  return { pronunciation: pronunciationEnabled(rtf), llm: hw.totalMemGB >= 6 && rtf <= 1.5 }
}

/** rtf from several timed runs (seconds) of one clip: the median, so one slow run cannot flip the decision. */
export function medianRtf(times: number[], clipSeconds: number): number {
  const s = [...times].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const t = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  return t / clipSeconds
}
