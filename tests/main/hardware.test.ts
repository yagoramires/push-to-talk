import { describe, expect, test, vi } from 'vitest'

vi.mock('electron', () => ({ app: {} }))
const { hasDedicatedGpu } = await import('../../src/main/ai/hardware')

describe('hasDedicatedGpu', () => {
  test('an idle NVIDIA next to the active Intel GPU counts (Optimus laptop)', () => {
    expect(
      hasDedicatedGpu([
        { vendorId: 0x8086, active: true },
        { vendorId: 0x10de, active: false }
      ])
    ).toBe(true)
  })
  test('Intel only, or no info, is integrated', () => {
    expect(hasDedicatedGpu([{ vendorId: 0x8086, active: true }])).toBe(false)
    expect(hasDedicatedGpu(undefined)).toBe(false)
  })
})
