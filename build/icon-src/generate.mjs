/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain build script, no types */
// Regenerates every app icon from build/icon-src/icon.svg (the full icon: rounded square + "ptt" with a headset).
// Run from the repo root: node build/icon-src/generate.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const SVG = readFileSync('build/icon-src/icon.svg', 'utf8')
// Without the rounded square: Android draws its own shape over a flat background
const GLYPHS = SVG.replace(/<rect width="1024"[^>]*\/>/, '')
const BG = '#1c2038' // middle of the icon's background gradient
const SPLASH_BG = '#12152a' // the app's dark background
const RES = 'android/app/src/main/res'

const render = (svg, n) =>
  sharp(Buffer.from(svg), { density: Math.max(72, (72 * n) / 1024) * 4 }).resize(n, n)
const png = (img, out) => img.png().toFile(out)
const canvas = (n, background, art) =>
  sharp({ create: { width: n, height: n, channels: 4, background } }).composite([
    { input: art, gravity: 'center' }
  ])
// Desktop: the square at 80% with a transparent margin, the macOS icon grid (824 of 1024)
const desktop = async (n) =>
  canvas(
    n,
    '#0000',
    await render(SVG, Math.round(n * 0.805))
      .png()
      .toBuffer()
  )
// Android shows the middle 72 of 108 dp; at 60% the letters stay well inside that circle
const foreground = async (n) =>
  canvas(
    n,
    '#0000',
    await render(GLYPHS, Math.round(n * 0.6))
      .png()
      .toBuffer()
  )

await png(await desktop(1024), 'build/icon.png')
await png(await desktop(512), 'resources/icon.png')

const iconset = join(mkdtempSync(join(tmpdir(), 'icon-')), 'icon.iconset')
mkdirSync(iconset)
for (const n of [16, 32, 128, 256, 512]) {
  await png(await desktop(n), join(iconset, `icon_${n}x${n}.png`))
  await png(await desktop(n * 2), join(iconset, `icon_${n}x${n}@2x.png`))
}
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', 'build/icon.icns'])
rmSync(iconset, { recursive: true })

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${d}`
  const legacy = Math.round(48 * k)
  await png(render(SVG, legacy), `${dir}/ic_launcher.png`)
  const flat = await canvas(legacy, BG, await render(GLYPHS, legacy).png().toBuffer())
    .png()
    .toBuffer()
  const mask = Buffer.from(
    `<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`
  )
  await png(
    sharp(flat).composite([{ input: mask, blend: 'dest-in' }]),
    `${dir}/ic_launcher_round.png`
  )
  await png(await foreground(Math.round(108 * k)), `${dir}/ic_launcher_foreground.png`)
}
writeFileSync(
  `${RES}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`
)

// Splash: the icon centered on the app's dark background, a third of the shorter side
const splash = async (w, h, out) => {
  const art = await render(SVG, Math.round(Math.min(w, h) / 3))
    .png()
    .toBuffer()
  await png(
    sharp({ create: { width: w, height: h, channels: 4, background: SPLASH_BG } }).composite([
      { input: art, gravity: 'center' }
    ]),
    out
  )
}
const sizes = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920]
}
for (const [d, [w, h]] of Object.entries(sizes)) {
  await splash(w, h, `${RES}/drawable-port-${d}/splash.png`)
  await splash(h, w, `${RES}/drawable-land-${d}/splash.png`)
}
await splash(480, 320, `${RES}/drawable/splash.png`)
console.log('icons written')
