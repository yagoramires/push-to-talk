import { app } from 'electron'
import { cpus, totalmem } from 'os'
import type { Hardware } from '../../shared/api'
import { toGB } from './tiers'

const NVIDIA = 4318
const AMD = 4098

type GpuDevice = { vendorId: number; deviceString?: string; active?: boolean }

/**
 * NVIDIA or AMD present counts, active or not: on Windows laptops the screen runs on the Intel GPU
 * and the dedicated one sits idle (Optimus), so requiring `active` missed it.
 * shortcut: AMD integrated Radeon (Ryzen APU) also counts as dedicated; tell them apart if tiers misfire.
 */
export const hasDedicatedGpu = (devices: GpuDevice[] = []): boolean =>
  devices.some((g) => g.vendorId === NVIDIA || g.vendorId === AMD)

export async function detectHardware(): Promise<Hardware> {
  const cpu = cpus()
  let hasDiscreteGpu = false
  try {
    const info = (await app.getGPUInfo('basic')) as { gpuDevice?: GpuDevice[] }
    hasDiscreteGpu = hasDedicatedGpu(info.gpuDevice)
    console.info('gpu', JSON.stringify(info.gpuDevice ?? []))
  } catch (e) {
    console.warn('gpu info unavailable, assuming integrated', e)
  }
  return {
    platform: process.platform,
    arch: process.arch,
    totalMemGB: toGB(totalmem()),
    cpuModel: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    hasDiscreteGpu
  }
}
