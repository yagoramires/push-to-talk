import type {
  ChoiceExercise,
  CommonError,
  FillExercise,
  MatchExercise,
  OrderExercise
} from './content'

export const ALMOST_THRESHOLD = 0.75
export type Verdict = 'correct' | 'almost' | 'error' | 'unclear'
export type FinalVerdict = 'correct' | 'error'
export type WordDiff = { word: string; status: 'ok' | 'missing' | 'extra' }
export type CheckResult = {
  verdict: Verdict
  matchedError?: CommonError
  closest?: string
  diff?: WordDiff[]
}

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "it's": 'it is',
  "he's": 'he is',
  "she's": 'she is',
  "we're": 'we are',
  "they're": 'they are',
  "that's": 'that is',
  "what's": 'what is',
  "there's": 'there is',
  "let's": 'let us',
  "i've": 'i have',
  "i'll": 'i will',
  "i'd": 'i would',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "couldn't": 'could not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "we'll": 'we will',
  "they'll": 'they will',
  "you'd": 'you would',
  "he'd": 'he would',
  "she'd": 'she would',
  "we'd": 'we would',
  "they'd": 'they would',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not'
}
const CONTRACTION_RE = new RegExp(`\\b(${Object.keys(CONTRACTIONS).join('|')})\\b`, 'g')

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen'
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function numberToWords(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : TENS[n / 10]
  const rest = n % 100
  return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` ${numberToWords(rest)}` : ''}`
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/-/g, ' ')
    .replace(CONTRACTION_RE, (m) => CONTRACTIONS[m])
    .replace(/\bcan not\b/g, 'cannot')
    .replace(/\b\d{1,3}\b/g, (m) => numberToWords(Number(m)))
    .replace(/[^a-z0-9 ]/g, ' ') // apostrophes and punctuation; shortcut: non-ASCII letters are dropped, fine for English
    .replace(/\s+/g, ' ')
    .trim()
}

const words = (s: string): string[] => (s ? s.split(' ') : [])

function levenshtein(a: string[], b: string[]): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const wa = words(a)
  const wb = words(b)
  const max = Math.max(wa.length, wb.length)
  return max === 0 ? 1 : 1 - levenshtein(wa, wb) / max
}

/** expected/actual já normalizados. */
export function wordDiff(expected: string, actual: string): WordDiff[] {
  const e = words(expected)
  const a = words(actual)
  const lcs = Array.from({ length: e.length + 1 }, () => new Array<number>(a.length + 1).fill(0))
  for (let i = e.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      lcs[i][j] = e[i] === a[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: WordDiff[] = []
  let i = 0
  let j = 0
  while (i < e.length || j < a.length) {
    if (i < e.length && j < a.length && e[i] === a[j]) {
      out.push({ word: e[i++], status: 'ok' })
      j++
    } else if (j >= a.length || (i < e.length && lcs[i + 1][j] >= lcs[i][j + 1]))
      out.push({ word: e[i++], status: 'missing' })
    else out.push({ word: a[j++], status: 'extra' })
  }
  return out
}

// Slot `*` in an accepted answer = 1-3 free words (a country, a name). '…' never survives normalize(), so it is a safe token.
const SLOT = '…'
export const showAccepted = (a: string): string => a.replace(/\*/g, SLOT)
const normAccepted = (a: string): string => a.split('*').map(normalize).join(` ${SLOT} `).trim()
const matchesSlots = (n: string, t: string): boolean =>
  new RegExp(`^${n.replaceAll(SLOT, '\\S+(?: \\S+){0,2}')}$`).test(t)

/** Fills each slot with the transcript span (1-3 words) that brings the answer closest to t. */
function fillSlots(n: string, t: string): string {
  if (!n.includes(SLOT)) return n
  const tw = words(t)
  let best = n
  for (let i = 0; i < tw.length; i++)
    for (let k = 1; k <= 3 && i + k <= tw.length; k++) {
      const c = n.replace(SLOT, tw.slice(i, i + k).join(' '))
      if (similarity(c, t) > similarity(best, t)) best = c
    }
  return best === n ? n : fillSlots(best, t)
}

export function checkAnswer(
  transcript: string,
  ex: { accepted: string[]; commonErrors: CommonError[] }
): CheckResult {
  const t = normalize(transcript)
  if (!t) return { verdict: 'unclear' }
  const norms = ex.accepted.map(normAccepted)
  if (norms.some((n) => matchesSlots(n, t))) return { verdict: 'correct' }
  const filled = norms.map((n) => fillSlots(n, t))
  let best = 0
  let bestSim = -1
  filled.forEach((n, i) => {
    const s = similarity(n, t)
    if (s > bestSim) {
      best = i
      bestSim = s
    }
  })
  const closest = showAccepted(ex.accepted[best])
  const diff = wordDiff(filled[best], t)
  const matchedError = ex.commonErrors.find((c) => new RegExp(c.match).test(t))
  if (matchedError) return { verdict: 'error', matchedError, closest, diff }
  return { verdict: bestSim >= ALMOST_THRESHOLD ? 'almost' : 'error', closest, diff }
}

export function toFinalVerdict(r: CheckResult): FinalVerdict | null {
  if (r.verdict === 'unclear') return null
  return r.verdict === 'error' ? 'error' : 'correct'
}

export function checkChoice(ex: ChoiceExercise, index: number): CheckResult {
  return index === ex.answer
    ? { verdict: 'correct' }
    : { verdict: 'error', closest: ex.options[ex.answer] }
}

export function checkFill(ex: FillExercise, typed: string): CheckResult {
  return checkAnswer(typed, ex)
}

export function checkOrder(ex: OrderExercise, wordList: string[]): CheckResult {
  const t = normalize(wordList.join(' '))
  return ex.accepted.some((a) => normalize(a) === t)
    ? { verdict: 'correct' }
    : { verdict: 'error', closest: ex.accepted[0] }
}

export function checkMatch(ex: MatchExercise, chosen: Record<string, string>): CheckResult {
  return ex.pairs.every((p) => chosen[p.en] === p.pt)
    ? { verdict: 'correct' }
    : { verdict: 'error' }
}
