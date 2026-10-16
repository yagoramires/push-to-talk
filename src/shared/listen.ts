import type { AssessmentItem, Exercise } from './content'

/** Texts the exercise plays with "Ouvir"; the screen and the audio generator both use this. */
export function listenTexts(ex: Exercise | AssessmentItem): string[] {
  if ('exercise' in ex) return listenTexts(ex.exercise)
  switch (ex.kind) {
    case 'vocab':
      return [`${ex.word_en}. ${ex.example_en}`]
    case 'free_speak':
      return [ex.prompt_en]
    case 'repeat':
    case 'translate':
    case 'listen_answer': {
      const text = ex.listen ?? ex.prompt
      return text ? [text] : []
    }
    case 'choice':
      return ex.listen ? [ex.listen] : []
    case 'dialogue':
      return ex.turns.flatMap((t) => (t.speaker === 'partner' ? [t.text] : []))
    default:
      return []
  }
}
