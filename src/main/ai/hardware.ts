import { app } from 'electron'
import { cpus, totalmem } from 'os'
import type { Hardware } from '../../shared/api'

const NVIDIA = 4318
const AMD = 4098

export async function detectHardware(): Promise<Hardware> {
  const cpu = cpus()
  let hasDiscreteGpu = false
  try {
    const info = (await app.getGPUInfo('basic')) as {
      gpuDevice?: { vendorId: number; active?: boolean }[]
    }
    hasDiscreteGpu = !!info.gpuDevice?.some(
      (g) => (g.vendorId === NVIDIA || g.vendorId === AMD) && g.active
    )
  } catch {
    // sem info de GPU: assume integrada
  }
  return {
    platform: process.platform,
    arch: process.arch,
    totalMemGB: totalmem() / 1024 ** 3,
    cpuModel: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    hasDiscreteGpu
  }
}
