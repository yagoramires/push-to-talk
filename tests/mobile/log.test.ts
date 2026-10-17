import { afterEach, expect, test, vi } from 'vitest'
import { initMobileLog } from '../../src/mobile/log'
import { memFs } from './memfs'

const saved = { ...console }
afterEach(() => Object.assign(console, saved))
const flush = (): Promise<unknown> => new Promise((r) => setTimeout(r, 0))

test('console.info ends up in logs/main.log and the previous log is rotated', async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  const fs = memFs()
  fs.files.set('logs/main.log', 'antes\n')
  initMobileLog(fs)
  console.info('x', { a: 1 }, new Error('boom'))
  await flush()
  expect(fs.files.get('logs/main.old.log')).toBe('antes\n')
  const log = fs.files.get('logs/main.log') as string
  expect(log).toMatch(/INFO x {"a":1} Error: boom/)
})

test('a rejecting append does not break the app', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fs = memFs()
  fs.append = () => Promise.reject(new Error('disk full'))
  initMobileLog(fs)
  expect(() => console.warn('y')).not.toThrow()
  await flush()
})
