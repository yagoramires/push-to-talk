import { expect, test } from 'vitest'
import { chooseTier, pronunciationEnabled, toGB } from '../../src/main/ai/tiers'
import type { Hardware } from '../../src/shared/api'

const hw = (o: Partial<Hardware>): Hardware => ({
  platform: 'win32',
  arch: 'x64',
  totalMemGB: 16,
  cpuModel: 'x',
  cores: 8,
  hasDiscreteGpu: false,
  ...o
})
const mac = (totalMemGB: number): Hardware => hw({ platform: 'darwin', arch: 'arm64', totalMemGB })

test('Mac arm64: 16 GB strong, 8 GB medium', () => {
  expect(chooseTier(mac(16), null)).toBe('strong')
  expect(chooseTier(mac(8), null)).toBe('medium')
})

test('under 12 GB is light', () => {
  expect(chooseTier(hw({ totalMemGB: 8 }), 0.1)).toBe('light')
})

test('16 GB: rtf decides, discrete GPU overrides, null counts as 1.0', () => {
  expect(chooseTier(hw({}), 0.5)).toBe('medium')
  expect(chooseTier(hw({}), 0.9)).toBe('light')
  expect(chooseTier(hw({ hasDiscreteGpu: true }), 0.9)).toBe('medium')
  expect(chooseTier(hw({}), null)).toBe('light')
})

test('pronunciation is off only above rtf 1.0', () => {
  expect(pronunciationEnabled(1.2)).toBe(false)
  expect(pronunciationEnabled(0.9)).toBe(true)
  expect(pronunciationEnabled(null)).toBe(true)
})

test('toGB rounds so a 15.7 GB-reported "16 GB" machine counts as 16 and picks medium', () => {
  const gb = toGB(15.7 * 1024 ** 3)
  expect(gb).toBe(16)
  expect(chooseTier(hw({ totalMemGB: gb }), 0.5)).toBe('medium')
})
