import { describe, expect, it } from 'vitest'
import { checkRelease, isNewer, releaseAsset, type Release } from '../../src/shared/update'

const release: Release = {
  tag_name: 'v1.2.0',
  html_url: 'https://github.com/yagoramires/push-to-talk/releases/tag/v1.2.0',
  assets: [
    { name: 'Push-to-Talk-1.2.0-setup.exe', browser_download_url: 'https://x/setup.exe' },
    { name: 'Push-to-Talk-1.2.0-mac-arm64.dmg', browser_download_url: 'https://x/mac.dmg' },
    { name: 'Push-to-Talk-1.2.0-android.apk', browser_download_url: 'https://x/android.apk' }
  ]
}

describe('isNewer', () => {
  it.each([
    ['1.2.0', '1.1.0', true],
    ['v1.1.1', '1.1.0', true],
    ['2.0.0', '1.9.9', true],
    ['1.10.0', '1.9.0', true],
    ['v1.1.0', '1.1.0', false],
    ['1.0.9', '1.1.0', false],
    ['0.9.0', '1.0.0', false],
    ['1.2', '1.1.0', false],
    ['1.2.0-beta', '1.1.0', false],
    ['', '1.1.0', false],
    ['1.2.0', 'dev', false]
  ])('%s over %s is %s', (latest, current, expected) => {
    expect(isNewer(latest, current)).toBe(expected)
  })
})

describe('releaseAsset', () => {
  it('picks the asset by name suffix', () => {
    expect(releaseAsset(release, '-android.apk')).toBe('https://x/android.apk')
    expect(releaseAsset(release, '-mac-arm64.dmg')).toBe('https://x/mac.dmg')
  })

  it('is undefined when no asset matches', () => {
    expect(releaseAsset(release, '-linux.AppImage')).toBeUndefined()
  })
})

describe('checkRelease', () => {
  const fakeFetch = (body: unknown, status = 200): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('returns the version and the installer of a newer release', async () => {
    expect(await checkRelease(fakeFetch(release), '1.1.0', '-mac-arm64.dmg')).toEqual({
      version: '1.2.0',
      url: 'https://x/mac.dmg'
    })
  })

  it('falls back to the release page when the asset is missing', async () => {
    const r = await checkRelease(fakeFetch({ ...release, assets: [] }), '1.1.0', '-mac-arm64.dmg')
    expect(r?.url).toBe(release.html_url)
  })

  it('is null for the same version', async () => {
    expect(await checkRelease(fakeFetch(release), '1.2.0', '-mac-arm64.dmg')).toBeNull()
  })

  it('throws on an HTTP error', async () => {
    await expect(checkRelease(fakeFetch({}, 403), '1.1.0', '.dmg')).rejects.toThrow('403')
  })
})
