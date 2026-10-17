export type Release = {
  tag_name: string
  html_url: string
  assets: { name: string; browser_download_url: string }[]
}

const LATEST = 'https://api.github.com/repos/yagoramires/push-to-talk/releases/latest'

const parse = (v: string): number[] | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim())
  return m ? m.slice(1).map(Number) : null
}

/** Semver x.y.z, a leading "v" allowed; anything else is never newer. */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest)
  const b = parse(current)
  if (!a || !b) return false
  const i = a.findIndex((n, k) => n !== b[k])
  return i >= 0 && a[i] > b[i]
}

export function releaseAsset(release: Release, suffix: string): string | undefined {
  return release.assets.find((a) => a.name.endsWith(suffix))?.browser_download_url
}

/** The latest GitHub release when newer than `current`, with the installer to download; throws offline. */
export async function checkRelease(
  doFetch: typeof fetch,
  current: string,
  suffix: string
): Promise<{ version: string; url: string } | null> {
  const res = await doFetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub releases: HTTP ${res.status}`)
  const release = (await res.json()) as Release
  if (!isNewer(release.tag_name, current)) return null
  return {
    version: release.tag_name.replace(/^v/, ''),
    url: releaseAsset(release, suffix) ?? release.html_url
  }
}
