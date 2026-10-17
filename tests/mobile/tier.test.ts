import { describe, expect, it, test } from 'vitest'
import type { Hardware } from '../../src/shared/api'
import { chooseMobileSetup, medianRtf } from '../../src/mobile/tier'

const hw = (totalMemGB: number): Hardware => ({
  platform: 'android',
  arch: 'arm64',
  totalMemGB,
  cpuModel: '',
  cores: 8,
  hasDiscreteGpu: false
})

test.each([
  [8, 1.2, { pronunciation: false, llm: true }],
  [4, 0.5, { pronunciation: true, llm: false }],
  [8, 0.9, { pronunciation: true, llm: true }],
  [6, 1.6, { pronunciation: false, llm: false }],
  [6, 1.5, { pronunciation: false, llm: true }],
  [8, 1.6, { pronunciation: false, llm: false }]
])('%i GB, rtf %f', (gb, rtf, want) => {
  expect(chooseMobileSetup(hw(gb), rtf)).toEqual(want)
})

describe('medianRtf', () => {
  it('ignores one slow run', () => {
    expect(medianRtf([2, 4.7, 2.2], 2)).toBeCloseTo(1.1)
  })
  it('averages the middle pair for an even count', () => {
    expect(medianRtf([1, 3, 2, 10], 1)).toBe(2.5)
  })
})
