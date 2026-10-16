import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, test, vi } from 'vitest'
import { initLog } from '../../src/main/log'

const saved = { ...console }
afterAll(() => Object.assign(console, saved))

test('copies console output to main.log and keeps the previous run as main.old.log', () => {
  const dir = mkdtempSync(join(tmpdir(), 'log-'))
  writeFileSync(join(dir, 'main.log'), 'previous run\n')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const path = initLog(dir)
  console.warn('pronunciation failed', { code: 3 })
  expect(readFileSync(join(dir, 'main.old.log'), 'utf8')).toBe('previous run\n')
  expect(readFileSync(path, 'utf8')).toMatch(/^\S+Z WARN pronunciation failed \{ code: 3 \}\n$/)
})
