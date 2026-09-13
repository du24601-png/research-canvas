#!/usr/bin/env node
/**
 * Generate a neutral temporary product mark (dark rounded square + canvas grid)
 * into icons/logo*.png, then stage PWA/favicon assets.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = path.join(REPO_ROOT, 'icons')

const MARK_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#1A1A1A"/>
  <g fill="none" stroke="#F0F0F0" stroke-width="18" stroke-linejoin="round">
    <rect x="96" y="112" width="200" height="140" rx="20"/>
    <rect x="216" y="228" width="200" height="140" rx="20"/>
  </g>
  <rect x="124" y="148" width="88" height="10" rx="5" fill="#F0F0F0"/>
  <rect x="124" y="176" width="144" height="10" rx="5" fill="#F0F0F0" opacity="0.55"/>
  <rect x="124" y="204" width="112" height="10" rx="5" fill="#F0F0F0" opacity="0.35"/>
  <rect x="248" y="264" width="72" height="72" rx="10" fill="#F0F0F0" opacity="0.92"/>
  <rect x="336" y="280" width="48" height="56" rx="8" fill="#F0F0F0" opacity="0.45"/>
</svg>
`

function pngToIco(pngBuffers) {
  const count = pngBuffers.length
  const headerSize = 6 + 16 * count
  let offset = headerSize
  const chunks = []
  for (const buf of pngBuffers) {
    chunks.push({ buf, offset })
    offset += buf.length
  }
  const out = Buffer.alloc(offset)
  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(count, 4)
  for (let i = 0; i < count; i++) {
    const buf = pngBuffers[i]
    const width = buf.readUInt32BE(16)
    const entry = 6 + 16 * i
    out.writeUInt8(width >= 256 ? 0 : width, entry)
    out.writeUInt8(width >= 256 ? 0 : width, entry + 1)
    out.writeUInt8(0, entry + 2)
    out.writeUInt8(0, entry + 3)
    out.writeUInt16LE(1, entry + 4)
    out.writeUInt16LE(32, entry + 6)
    out.writeUInt32LE(buf.length, entry + 8)
    out.writeUInt32LE(chunks[i].offset, entry + 12)
    buf.copy(out, chunks[i].offset)
  }
  return out
}

async function renderPng(svg, size) {
  const { default: sharp } = await import('sharp')
  return sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer()
}

async function writeScreenshot(file, width, height, title, subtitle) {
  const { default: sharp } = await import('sharp')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#141414"/>
  <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.18)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.64)}" rx="${Math.round(Math.min(width, height) * 0.03)}" fill="#1A1A1A"/>
  <text x="${Math.round(width / 2)}" y="${Math.round(height * 0.46)}" text-anchor="middle" fill="#F0F0F0" font-family="Segoe UI, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.055)}" font-weight="600">${title}</text>
  <text x="${Math.round(width / 2)}" y="${Math.round(height * 0.54)}" text-anchor="middle" fill="#A0A0A0" font-family="Segoe UI, sans-serif" font-size="${Math.round(Math.min(width, height) * 0.028)}">${subtitle}</text>
</svg>`
  await sharp(Buffer.from(svg)).png().toFile(file)
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true })
  const svgPath = path.join(ICONS_DIR, 'product-mark.svg')
  fs.writeFileSync(svgPath, MARK_SVG)

  const sizes = {
    'logo.png': 512,
    'logo@16.png': 16,
    'logo@32.png': 32,
    'logo@64.png': 64,
    'logo@512.png': 512,
  }
  for (const [name, size] of Object.entries(sizes)) {
    const buf = await renderPng(MARK_SVG, size)
    fs.writeFileSync(path.join(ICONS_DIR, name), buf)
  }

  const screenshotsDir = path.join(REPO_ROOT, 'client-ui', 'public', 'screenshots')
  fs.mkdirSync(screenshotsDir, { recursive: true })
  await writeScreenshot(
    path.join(screenshotsDir, 'narrow.png'),
    1080,
    1920,
    'Research Canvas',
    'AI 投研 Agent · 交互式数据分析画布',
  )
  await writeScreenshot(
    path.join(screenshotsDir, 'wide.png'),
    1920,
    1080,
    'Research Canvas',
    'AI 投研 Agent · 交互式数据分析画布',
  )

  const { default: pngToIcoLib } = await import('png-to-ico').catch(() => ({ default: null }))
  const fav16 = fs.readFileSync(path.join(ICONS_DIR, 'logo@16.png'))
  const fav32 = fs.readFileSync(path.join(ICONS_DIR, 'logo@32.png'))
  const ico = pngToIcoLib
    ? await pngToIcoLib([path.join(ICONS_DIR, 'logo@16.png'), path.join(ICONS_DIR, 'logo@32.png')])
    : pngToIco([fav16, fav32])
  fs.writeFileSync(path.join(ICONS_DIR, 'favicon.ico'), ico)
}

await main()
console.log('Product mark PNGs written to icons/')
