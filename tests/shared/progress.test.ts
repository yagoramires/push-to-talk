import { describe, expect, test } from 'vitest'
import { makeCourse } from '../fixtures/course'
import {
  completeBlock,
  newProgress,
  recordAttempt,
  recordSession,
  soloSinceLastGuided
} from '../../src/shared/progress'

const course = makeCourse()
const at = '2026-10-15T10:00:00Z'
const fresh = () => newProgress('p1', 'A1', course)
const attempt = (exerciseId: string, verdict: 'correct' | 'error', t = at, transcript = 'x') => ({
  exerciseId,
  unitId: 'u1',
  transcript,
  verdict,
  at: t
})

describe('progress', () => {
  test('newProgress starts at first unit of the level; unknown level throws', () => {
    expect(fresh()).toMatchObject({
      profileId: 'p1',
      startLevel: 'A1',
      position: { unitId: 'u1', blockIndex: 0 },
      completedBlocks: [],
      errorLog: [],
      sessions: []
    })
    expect(() => newProgress('p1', 'B2', course)).toThrow()
  })

  test('repeated error on same exercise does not duplicate; correct resolves it', () => {
    let p = recordAttempt(fresh(), attempt('e1', 'error', 't1', 'a'))
    p = recordAttempt(p, attempt('e1', 'error', 't2', 'b'))
    expect(p.errorLog).toEqual([
      { exerciseId: 'e1', unitId: 'u1', transcript: 'b', at: 't2', resolved: false }
    ])
    p = recordAttempt(p, attempt('e2', 'error'))
    expect(p.errorLog).toHaveLength(2)
    p = recordAttempt(p, attempt('e1', 'correct'))
    expect(p.errorLog.map((e) => [e.exerciseId, e.resolved])).toEqual([
      ['e1', true],
      ['e2', false]
    ])
    // a new error after resolution opens a fresh entry
    p = recordAttempt(p, attempt('e1', 'error'))
    expect(p.errorLog.filter((e) => e.exerciseId === 'e1')).toHaveLength(2)
    // a correct answer with no prior error changes nothing
    expect(recordAttempt(fresh(), attempt('e9', 'correct')).errorLog).toEqual([])
  })

  test('completeBlock advances within unit, across units, and to null at the end; no duplicate blockIds', () => {
    let p = completeBlock(fresh(), course, 'u1-warmup')
    expect(p.position).toEqual({ unitId: 'u1', blockIndex: 1 })
    expect(p.completedBlocks).toEqual(['u1-warmup'])
    // repeating a finished block neither duplicates it nor moves the position
    p = completeBlock(p, course, 'u1-warmup')
    expect(p.completedBlocks).toEqual(['u1-warmup'])
    expect(p.position).toEqual({ unitId: 'u1', blockIndex: 1 })
    p = { ...p, position: { unitId: 'u1', blockIndex: 5 } }
    p = completeBlock(p, course, 'u1-review')
    expect(p.position).toEqual({ unitId: 'u2', blockIndex: 0 })
    p = completeBlock({ ...p, position: { unitId: 'u2', blockIndex: 5 } }, course, 'u2-review')
    expect(p.position).toBeNull()
    expect(new Set(p.completedBlocks).size).toBe(p.completedBlocks.length)
    // a block that is not the current one is recorded but does not move the position
    const q = completeBlock(fresh(), course, 'u2-review')
    expect(q.position).toEqual({ unitId: 'u1', blockIndex: 0 })
    expect(q.completedBlocks).toEqual(['u2-review'])
  })

  test('soloSinceLastGuided returns only solo sessions after the last guided one, their blocks, and open errors', () => {
    const s = (t: string, mode: 'solo' | 'guided', blocksDone: string[]) => ({
      at: t,
      mode,
      minutes: 10,
      blocksDone,
      errors: 0
    })
    let p = recordAttempt(fresh(), attempt('e1', 'error'))
    p = recordAttempt(p, attempt('e2', 'error'))
    p = recordAttempt(p, attempt('e2', 'correct'))
    for (const r of [
      s('1', 'solo', ['a']),
      s('2', 'guided', ['b']),
      s('3', 'solo', ['c', 'd']),
      s('4', 'solo', ['d', 'e'])
    ])
      p = recordSession(p, r)
    const r = soloSinceLastGuided(p)
    expect(r.sessions.map((x) => x.at)).toEqual(['3', '4'])
    expect(r.blocksDone.sort()).toEqual(['c', 'd', 'e'])
    expect(r.openErrors.map((e) => e.exerciseId)).toEqual(['e1'])

    // never guided: all sessions count
    const all = recordSession(recordSession(fresh(), s('1', 'solo', ['a'])), s('2', 'solo', ['b']))
    expect(soloSinceLastGuided(all).sessions).toHaveLength(2)
  })

  test('functions do not mutate their input', () => {
    const p = fresh()
    const snap = structuredClone(p)
    recordAttempt(p, attempt('e1', 'error'))
    completeBlock(p, course, 'u1-warmup')
    recordSession(p, { at, mode: 'solo', minutes: 10, blocksDone: [], errors: 0 })
    expect(p).toEqual(snap)
    const withErr = recordAttempt(p, attempt('e1', 'error'))
    const snap2 = structuredClone(withErr)
    recordAttempt(withErr, attempt('e1', 'correct'))
    expect(withErr).toEqual(snap2)
  })
})
