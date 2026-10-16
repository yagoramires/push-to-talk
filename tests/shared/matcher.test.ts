import { expect, test } from 'vitest'
import type {
  ChoiceExercise,
  FillExercise,
  MatchExercise,
  OrderExercise
} from '../../src/shared/content'
import {
  checkAnswer,
  checkChoice,
  checkFill,
  checkMatch,
  checkOrder,
  normalize,
  toFinalVerdict,
  wordDiff
} from '../../src/shared/matcher'

const ex = {
  accepted: ['I am twenty-five years old', "I'm 25"],
  commonErrors: [
    {
      id: 'have-years',
      match: '\\bi have \\w+( \\w+)? years\\b',
      explanation_pt: 'Idade usa "to be".',
      correction_en: "I'm 25 years old."
    }
  ]
}

test('normalize: case, curly apostrophes, contractions, numbers 0-999, punctuation, spaces', () => {
  expect(normalize("I'm 25!")).toBe('i am twenty five')
  expect(normalize('I AM twenty-five,  years old.')).toBe('i am twenty five years old')
  expect(normalize('It’s 100')).toBe('it is one hundred')
  expect(normalize("You can't, I won't")).toBe('you cannot i will not')
  expect(normalize('342')).toBe('three hundred forty two')
  expect(normalize('   ')).toBe('')
})
test('exact match after normalization is correct', () => {
  expect(checkAnswer("I'm twenty five", ex).verdict).toBe('correct')
  expect(checkAnswer('I am 25 years old.', ex).verdict).toBe('correct')
})
test('common error beats fuzzy match and carries the explanation', () => {
  const r = checkAnswer('I have 25 years', ex)
  expect(r.verdict).toBe('error')
  expect(r.matchedError?.id).toBe('have-years')
})
test('close answer is almost and points to closest accepted', () => {
  const r = checkAnswer('yes I am twenty five years old', ex)
  expect(r.verdict).toBe('almost')
  expect(r.closest).toBe('I am twenty-five years old')
})
test('unrelated answer is error without explanation but with closest', () => {
  const r = checkAnswer('my name is john', ex)
  expect(r.verdict).toBe('error')
  expect(r.matchedError).toBeUndefined()
  expect(r.closest).toBeDefined()
})
test('empty transcript is unclear and is not recorded', () => {
  const r = checkAnswer('', ex)
  expect(r.verdict).toBe('unclear')
  expect(toFinalVerdict(r)).toBeNull()
})
test('almost counts as correct', () => {
  expect(toFinalVerdict({ verdict: 'almost' })).toBe('correct')
})
test('wordDiff marks missing and extra words', () => {
  expect(wordDiff('i am twenty five years old', 'i am twenty five')).toEqual([
    { word: 'i', status: 'ok' },
    { word: 'am', status: 'ok' },
    { word: 'twenty', status: 'ok' },
    { word: 'five', status: 'ok' },
    { word: 'years', status: 'missing' },
    { word: 'old', status: 'missing' }
  ])
  expect(wordDiff('i am', 'yes i am').map((d) => d.status)).toEqual(['extra', 'ok', 'ok'])
})
test('checkChoice', () => {
  const c: ChoiceExercise = {
    id: 'c',
    kind: 'choice',
    instruction_pt: '',
    options: ['am', 'is', 'are'],
    answer: 0
  }
  expect(checkChoice(c, 0).verdict).toBe('correct')
  expect(checkChoice(c, 2)).toMatchObject({ verdict: 'error', closest: 'am' })
})
test('checkOrder: exact order only, swapped words are an error', () => {
  const o: OrderExercise = {
    id: 'o',
    kind: 'order',
    instruction_pt: '',
    accepted: ['Where do you live?']
  }
  expect(checkOrder(o, ['where', 'do', 'you', 'live']).verdict).toBe('correct')
  expect(checkOrder(o, ['where', 'you', 'do', 'live']).verdict).toBe('error')
})
test('checkMatch requires every pair', () => {
  const m: MatchExercise = {
    id: 'm',
    kind: 'match',
    instruction_pt: '',
    pairs: [
      { en: 'dog', pt: 'cachorro' },
      { en: 'cat', pt: 'gato' },
      { en: 'cow', pt: 'vaca' }
    ]
  }
  expect(checkMatch(m, { dog: 'cachorro', cat: 'gato', cow: 'vaca' }).verdict).toBe('correct')
  expect(checkMatch(m, { dog: 'gato', cat: 'cachorro', cow: 'vaca' }).verdict).toBe('error')
})
test('checkFill uses spoken normalization (contractions, case)', () => {
  const f: FillExercise = {
    id: 'f',
    kind: 'fill',
    instruction_pt: '',
    sentence: 'She ___ a doctor.',
    accepted: ['is'],
    commonErrors: []
  }
  expect(checkFill(f, ' IS ').verdict).toBe('correct')
})
