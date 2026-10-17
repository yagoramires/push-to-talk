import { expect, test } from 'vitest'
import type { Hardware } from '../../src/shared/api'
import { chooseMobileSetup } from '../../src/mobile/tier'

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
  [6, 1.6, { pronunciation: false, llm: false }]
])('%i GB, rtf %f', (gb, rtf, want) => {
  expect(chooseMobileSetup(hw(gb), rtf)).toEqual(want)
})
