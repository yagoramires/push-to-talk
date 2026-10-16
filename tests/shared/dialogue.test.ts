import { expect, test } from 'vitest'
import { DialogueSchema } from '../../src/shared/content'
import { dialogueVerdict } from '../../src/shared/dialogue'
import { toFinalVerdict, type FinalVerdict } from '../../src/shared/matcher'

const partner = (text: string): { speaker: 'partner'; text: string } => ({
  speaker: 'partner',
  text
})
const you = { speaker: 'you', cue_pt: 'Diga oi', accepted: ['hi'], commonErrors: [] }
const dialogue = {
  id: 'd',
  kind: 'dialogue',
  instruction_pt: 'Converse',
  scene_pt: 'Na padaria',
  turns: [partner('Hello!'), you, partner('How are you?'), you, partner('Nice.'), you]
}

test('DialogueSchema accepts a valid dialogue', () => {
  expect(DialogueSchema.safeParse(dialogue).success).toBe(true)
})

test('DialogueSchema rejects a dialogue starting with you', () => {
  const turns = [you, partner('a'), you, partner('b'), you]
  expect(DialogueSchema.safeParse({ ...dialogue, turns }).success).toBe(false)
})

test('DialogueSchema rejects 2 or 7 you turns', () => {
  const two = [partner('a'), you, partner('b'), you]
  expect(DialogueSchema.safeParse({ ...dialogue, turns: two }).success).toBe(false)
  const seven = [partner('a'), you, you, you, you, you, you, you]
  expect(DialogueSchema.safeParse({ ...dialogue, turns: seven }).success).toBe(false)
})

test('DialogueSchema rejects a you turn with empty accepted', () => {
  const turns = [...dialogue.turns.slice(0, -1), { ...you, accepted: [] }]
  expect(DialogueSchema.safeParse({ ...dialogue, turns }).success).toBe(false)
})

test('dialogueVerdict is correct from 70% of the turns', () => {
  const v = (s: string): FinalVerdict[] => [...s].map((c) => (c === '1' ? 'correct' : 'error'))
  expect(dialogueVerdict(v('1101'))).toBe('correct')
  expect(dialogueVerdict(v('1100'))).toBe('error')
  expect(dialogueVerdict(v('1111'))).toBe('correct')
  expect(dialogueVerdict([])).toBe('error')
})

test('an "almost" turn counts as a hit', () => {
  const almost = toFinalVerdict({ verdict: 'almost' })!
  expect(dialogueVerdict([almost, almost, 'correct', 'error'])).toBe('correct')
})
