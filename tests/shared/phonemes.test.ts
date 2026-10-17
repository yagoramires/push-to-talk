import { expect, test } from 'vitest'
import { ctcGreedyDecode, scoreWords, tokenizeIpa } from '../../src/shared/ai/phonemes'

test('ctcGreedyDecode collapses repeats and drops the blank', () => {
  const idToToken = ['<pad>', 'h', 'ɛ', 'l']
  // argmax per frame: h h <pad> ɛ l <pad> l
  const best = [1, 1, 0, 2, 3, 0, 3]
  const logits = new Float32Array(best.length * 4)
  best.forEach((id, f) => (logits[f * 4 + id] = 5))
  expect(ctcGreedyDecode(logits, best.length, 4, idToToken, 0)).toEqual(['h', 'ɛ', 'l', 'l'])
})

test('tokenizeIpa strips stress marks and matches the longest vocab token', () => {
  const vocab = new Set(['h', 'ɛ', 'l', 'o', 'ʊ', 'oʊ', 'iː', 'i'])
  expect(tokenizeIpa('ˈhɛloʊ', vocab)).toEqual(['h', 'ɛ', 'l', 'oʊ'])
  // length mark not part of a vocab token is dropped
  expect(tokenizeIpa('ˌhɛː liː', vocab)).toEqual(['h', 'ɛ', 'l', 'iː'])
})

const expected = [
  { word: 'hello', phones: ['h', 'ɛ', 'l', 'oʊ'] },
  { word: 'bear', phones: ['b', 'ɛ', 'ɹ'] }
]

test('identical phonemes → score 100, every word ok', () => {
  const r = scoreWords(expected, ['h', 'ɛ', 'l', 'oʊ', 'b', 'ɛ', 'ɹ'])
  expect(r.score).toBe(100)
  expect(r.words.every((w) => w.ok)).toBe(true)
  expect(r.words[0]).toEqual({ word: 'hello', ok: true, expected: 'hɛloʊ', heard: 'hɛloʊ' })
})

test('half the phonemes of one word swapped → only that word fails', () => {
  const r = scoreWords(expected, ['h', 'a', 'l', 'u', 'b', 'ɛ', 'ɹ'])
  expect(r.words.map((w) => w.ok)).toEqual([false, true])
  expect(r.words[0].heard).toBe('halu')
  expect(r.score).toBe(Math.round(100 * (1 - 2 / 7)))
})

test('insertions count against the word they follow', () => {
  const r = scoreWords(expected, ['h', 'ɛ', 'l', 'oʊ', 'b', 'ɛ', 'ɹ', 'i', 'i'])
  expect(r.words.map((w) => w.ok)).toEqual([true, false])
  expect(r.words[1].heard).toBe('bɛɹii')
})

test('empty heard phonemes → score 0', () => {
  const r = scoreWords(expected, [])
  expect(r.score).toBe(0)
  expect(r.words.every((w) => !w.ok && w.heard === '')).toBe(true)
})

test('substitution inside an equivalence class keeps the word ok', () => {
  const words = [{ word: 'water', phones: ['w', 'ɔː', 't', 'ɚ'] }]
  const r = scoreWords(words, ['w', 'ɑ', 'ɾ', 'ɚ'])
  expect(r.score).toBe(100)
  expect(r.words[0]).toMatchObject({ ok: true, heard: 'wɑɾɚ' })
})

test('θ→f is still an error (real Brazilian substitution)', () => {
  const r = scoreWords([{ word: 'thin', phones: ['θ', 'ɪ', 'n'] }], ['f', 'i', 'n'])
  expect(r.words[0].ok).toBe(false)
})

test('equivalence is per class, not transitive (t~ɾ, d~ɾ, but t≁d)', () => {
  expect(scoreWords([{ word: 'x', phones: ['t'] }], ['d']).score).toBe(0)
})

const iAmHappy = [
  { word: 'i', phones: ['aɪ'] },
  { word: 'am', phones: ['æ', 'm'] },
  { word: 'happy', phones: ['h', 'æ', 'p', 'i'] }
]

test('unstressed function words are not graded (native weak form æm→ʌm)', () => {
  const r = scoreWords(iAmHappy, ['aɪ', 'ʌ', 'm', 'h', 'æ', 'p', 'i'])
  expect(r.score).toBe(100)
  expect(r.words.every((w) => w.ok)).toBe(true)
  expect(r.words[1].heard).toBe('ʌm')
})

test('graded neighbours of an ungraded word still count their errors', () => {
  const r = scoreWords(iAmHappy, ['aɪ', 'ʌ', 'm', 'h', 'ɛ', 'p', 'ɪ'])
  expect(r.words.map((w) => w.ok)).toEqual([true, true, false])
  expect(r.score).toBe(Math.round(100 * (1 - 2 / 5)))
})

test('sentence of ungraded words only → 100', () => {
  const r = scoreWords([{ word: 'the', phones: ['ð', 'ə'] }], ['d', 'a'])
  expect(r.score).toBe(100)
  expect(r.words[0].ok).toBe(true)
})
