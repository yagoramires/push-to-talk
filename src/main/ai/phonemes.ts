import type { PronunciationResult } from '../../shared/api'

/** Word is ok when its phoneme error rate is at most this. */
export const WORD_OK_PER = 0.34

/** Native allophones/weak forms the model mixes up ("na dúvida, aceitar"); ɪ/i, æ/ɛ, θ/t/f, ð/d stay distinct: real Brazilian errors. */
export const EQUIVALENT_PHONES: string[][] = [
  ['t', 'ɾ', 'ʔ'],
  ['d', 'ɾ'],
  ['ə', 'ɐ', 'ʌ'],
  ['ɚ', 'ɝ'],
  ['oʊ', 'o', 'oː'],
  ['eɪ', 'e'],
  ['ɑ', 'ɔ', 'ɒ', 'ɑː', 'ɔː'],
  ['i', 'iː'],
  ['u', 'uː'],
  ['ɹ', 'r']
]

const same = (a: string, b: string): boolean =>
  a === b || EQUIVALENT_PHONES.some((c) => c.includes(a) && c.includes(b))

/** Per-frame argmax, collapse repeats, drop the blank. `logits` is [frames, vocabSize] row-major. */
export function ctcGreedyDecode(
  logits: Float32Array,
  frames: number,
  vocabSize: number,
  idToToken: string[],
  blankId: number
): string[] {
  const out: string[] = []
  let prev = -1
  for (let f = 0; f < frames; f++) {
    let best = 0
    for (let v = 1; v < vocabSize; v++)
      if (logits[f * vocabSize + v] > logits[f * vocabSize + best]) best = v
    if (best !== prev && best !== blankId) out.push(idToToken[best])
    prev = best
  }
  return out
}

/** Greedy longest match against the model vocab; stress marks, spaces and unmatched chars (e.g. stray ː) are dropped. */
export function tokenizeIpa(ipa: string, vocab: Set<string>): string[] {
  const s = ipa.replace(/[ˈˌ\s]/g, '')
  const maxLen = Math.max(...[...vocab].map((t) => t.length))
  const out: string[] = []
  for (let i = 0; i < s.length;) {
    let len = Math.min(maxLen, s.length - i)
    while (len > 0 && !vocab.has(s.slice(i, i + len))) len--
    if (len > 0) out.push(s.slice(i, i + len))
    i += len || 1
  }
  return out
}

/** Levenshtein-aligns all expected phonemes with the heard ones; insertions count against the word of the preceding phoneme. */
export function scoreWords(
  expectedByWord: { word: string; phones: string[] }[],
  heard: string[]
): PronunciationResult {
  const exp = expectedByWord.flatMap((w, wi) => w.phones.map((p) => ({ p, wi })))
  const n = exp.length
  const m = heard.length
  const d = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (same(exp[i - 1].p, heard[j - 1]) ? 0 : 1)
      )

  const errors = expectedByWord.map(() => 0)
  const heardBy = expectedByWord.map(() => [] as string[])
  const wordAt = (i: number): number => exp[Math.max(0, i - 1)]?.wi ?? 0
  for (let i = n, j = m; i > 0 || j > 0;) {
    if (
      i > 0 &&
      j > 0 &&
      d[i][j] === d[i - 1][j - 1] + (same(exp[i - 1].p, heard[j - 1]) ? 0 : 1)
    ) {
      if (!same(exp[i - 1].p, heard[j - 1])) errors[exp[i - 1].wi]++
      heardBy[exp[i - 1].wi].unshift(heard[j - 1])
      i--
      j--
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      errors[exp[i - 1].wi]++
      i--
    } else {
      // insertion (j > 0 here); n === 0 means there is no word to blame
      if (n > 0) {
        errors[wordAt(i)]++
        heardBy[wordAt(i)].unshift(heard[j - 1])
      }
      j--
    }
  }

  return {
    score: n === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 * (1 - d[n][m] / n)))),
    words: expectedByWord.map((w, wi) => ({
      word: w.word,
      ok: errors[wi] / Math.max(1, w.phones.length) <= WORD_OK_PER,
      expected: w.phones.join(''),
      heard: heardBy[wi].join('')
    }))
  }
}
