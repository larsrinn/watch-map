#!/usr/bin/env node
// Generates PWA icon PNGs from favicon.svg using sharp (if available) or canvas.
// Falls back to a simple purple-on-dark placeholder if neither is installed.

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const svgPath = join(publicDir, 'favicon.svg')
const svgBuffer = readFileSync(svgPath)

const sizes = [192, 512]

async function withSharp() {
  const sharp = (await import('sharp')).default
  for (const size of sizes) {
    const padding = Math.round(size * 0.1)
    const iconSize = size - padding * 2
    // Create icon with dark background and centered SVG
    const bg = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 26, g: 26, b: 46, alpha: 1 }, // #1a1a2e
      },
    }).png()

    const resizedSvg = await sharp(svgBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()

    const out = await bg
      .composite([{ input: resizedSvg, left: padding, top: padding }])
      .toBuffer()

    writeFileSync(join(publicDir, `icon-${size}.png`), out)
    console.log(`Created icon-${size}.png`)
  }
}

try {
  await withSharp()
} catch {
  console.error('sharp not available — install it with: npm i -D sharp')
  console.error('Then re-run: node scripts/generate-icons.mjs')
  process.exit(1)
}
