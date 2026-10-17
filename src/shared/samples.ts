import type { Sample } from './api'

/** The wav name and the jsonl line for one sample; exerciseId comes from the renderer, so keep it a plain file name. */
export function sampleEntry(
  { exerciseId, mode, expected, hint, transcript, verdict }: Sample,
  at: Date
): { file: string; line: Omit<Sample, 'wav'> & { at: string; wav: string } } {
  const iso = at.toISOString()
  const file = `${iso.replace(/[:.]/g, '-')}-${exerciseId.replace(/[^\w#-]/g, '_')}.wav`
  return {
    file,
    line: { at: iso, exerciseId, mode, expected, hint, transcript, verdict, wav: file }
  }
}
