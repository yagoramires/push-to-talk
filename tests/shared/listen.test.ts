import { expect, test } from 'vitest'
import type { Exercise } from '../../src/shared/content'
import { listenTexts } from '../../src/shared/listen'

const base = { id: 'e', instruction_pt: 'x' }
const spoken = { ...base, accepted: ['a'], commonErrors: [] }

test.each<[Exercise, string[]]>([
  [
    { id: 'v', kind: 'vocab', word_en: 'hello', meaning_pt: 'olá', example_en: 'Hello, Ana.' },
    ['hello. Hello, Ana.']
  ],
  [
    { ...base, kind: 'free_speak', prompt_en: 'Talk about you.', guidelines_pt: ['g'] },
    ['Talk about you.']
  ],
  [{ ...spoken, kind: 'repeat', prompt: 'Good night.' }, ['Good night.']],
  [
    { ...spoken, kind: 'listen_answer', listen: 'How old are you?', prompt: 'p' },
    ['How old are you?']
  ],
  [{ ...spoken, kind: 'translate' }, []],
  [{ ...base, kind: 'choice', listen: 'Nine.', options: ['9', '5'], answer: 0 }, ['Nine.']],
  [{ ...base, kind: 'choice', options: ['9', '5'], answer: 0 }, []],
  [{ ...base, kind: 'fill', sentence: 'I ___ ok.', accepted: ['am'], commonErrors: [] }, []],
  [{ ...base, kind: 'order', accepted: ['a b'] }, []],
  [{ ...base, kind: 'match', pairs: [] }, []]
])('%o plays %o', (ex, texts) => {
  expect(listenTexts(ex)).toEqual(texts)
})

test('assessment items use their exercise', () => {
  const exercise: Exercise = { ...spoken, kind: 'repeat', prompt: 'Hi.' }
  expect(listenTexts({ skill: 'speaking', exercise })).toEqual(['Hi.'])
})
