import { expect, test } from 'vitest'
import { ctcGreedyDecode, scoreWords, tokenizeIpa } from '../../src/main/ai/phonemes'

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
  { word: 'there', phones: ['ð', 'ɛ', 'ɹ'] }
]

test('identical phonemes → score 100, every word ok', () => {
  const r = scoreWords(expected, ['h', 'ɛ', 'l', 'oʊ', 'ð', 'ɛ', 'ɹ'])
  expect(r.score).toBe(100)
  expect(r.words.every((w) => w.ok)).toBe(true)
  expect(r.words[0]).toEqual({ word: 'hello', ok: true, expected: 'hɛloʊ', heard: 'hɛloʊ' })
})

test('half the phonemes of one word swapped → only that word fails', () => {
  const r = scoreWords(expected, ['h', 'a', 'l', 'u', 'ð', 'ɛ', 'ɹ'])
  expect(r.words.map((w) => w.ok)).toEqual([false, true])
  expect(r.words[0].heard).toBe('halu')
  expect(r.score).toBe(Math.round(100 * (1 - 2 / 7)))
})

test('insertions count against the word they follow', () => {
  const r = scoreWords(expected, ['h', 'ɛ', 'l', 'oʊ', 'ð', 'ɛ', 'ɹ', 'i', 'i'])
  expect(r.words.map((w) => w.ok)).toEqual([true, false])
  expect(r.words[1].heard).toBe('ðɛɹii')
})

test('empty heard phonemes → score 0', () => {
  const r = scoreWords(expected, [])
  expect(r.score).toBe(0)
  expect(r.words.every((w) => !w.ok && w.heard === '')).toBe(true)
})
