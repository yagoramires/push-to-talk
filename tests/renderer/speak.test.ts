import { expect, test } from 'vitest'
import { speak } from '../../src/renderer/src/audio/speak'

test('speak does nothing without speechSynthesis (Android WebView)', () => {
  const g = globalThis as unknown as { window?: unknown }
  const before = g.window
  g.window = {}
  try {
    expect(() => speak('hi')).not.toThrow()
  } finally {
    g.window = before
  }
})
