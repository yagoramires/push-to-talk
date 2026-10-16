import type { FinalVerdict } from './matcher'

/** One verdict per "you" turn ("almost" already counts as correct); correct from 70% hits. */
export function dialogueVerdict(results: FinalVerdict[]): FinalVerdict {
  const hits = results.filter((r) => r === 'correct').length
  return results.length > 0 && hits >= 0.7 * results.length ? 'correct' : 'error'
}
