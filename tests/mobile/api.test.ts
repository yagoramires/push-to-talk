import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createMobileApi } from '../../src/mobile/api'

const track = (): { stop: ReturnType<typeof vi.fn> } => ({ stop: vi.fn() })
const stream = (t: ReturnType<typeof track>): MediaStream =>
  ({ getTracks: () => [t] }) as unknown as MediaStream

describe('ensureMic', () => {
  it('is false when the permission is refused', async () => {
    const api = createMobileApi({ getUserMedia: () => Promise.reject(new Error('denied')) })
    expect(await api.ensureMic()).toBe(false)
  })

  it('is true and releases the microphone', async () => {
    const t = track()
    const api = createMobileApi({ getUserMedia: async () => stream(t) })
    expect(await api.ensureMic()).toBe(true)
    expect(t.stop).toHaveBeenCalled()
  })
})

describe('loadCourse', () => {
  it('builds the real course from files served like the WebView does', async () => {
    const fakeFetch = (async (url: string) => {
      const path = url.replace(/^content\//, '')
      if (path === 'units/index.json')
        return new Response(JSON.stringify(readdirSync('content/units').sort()))
      return existsSync(`content/${path}`)
        ? new Response(readFileSync(`content/${path}`, 'utf8'))
        : new Response('', { status: 404 })
    }) as unknown as typeof fetch
    const course = await createMobileApi({ fetch: fakeFetch }).loadCourse()
    expect(course.units).toHaveLength(60)
  })
})

describe('urls', () => {
  it('points audio at the bundled content', () => {
    expect(createMobileApi().audioUrl('a.mp3')).toBe('content/audio/a.mp3')
  })
})
