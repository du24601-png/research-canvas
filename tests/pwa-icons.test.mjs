import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(repoRoot, 'client-ui', 'public')
const iconsDir = path.join(publicDir, 'icons')
const indexHtml = path.join(repoRoot, 'client-ui', 'index.html')

function readPngSize(file) {
  const buf = fs.readFileSync(file)
  assert.equal(buf.readUInt32BE(0), 0x89504e47, `not a PNG: ${file}`)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

test('PWA / favicon PNGs match declared sizes', () => {
  const expected = [
    ['favicon-16.png', 16],
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-512-maskable.png', 512],
  ]
  for (const [name, size] of expected) {
    const file = path.join(iconsDir, name)
    assert.ok(fs.existsSync(file), `missing ${name}`)
    const { width, height } = readPngSize(file)
    assert.equal(width, size, `${name} width`)
    assert.equal(height, size, `${name} height`)
  }
  const rootApple = path.join(publicDir, 'apple-touch-icon.png')
  assert.ok(fs.existsSync(rootApple), 'missing root apple-touch-icon.png')
  const rootSize = readPngSize(rootApple)
  assert.equal(rootSize.width, 180)
  assert.equal(rootSize.height, 180)
  assert.ok(fs.existsSync(path.join(publicDir, 'favicon.ico')), 'missing favicon.ico')
  assert.ok(!fs.existsSync(path.join(iconsDir, 'logo-192.png')), 'legacy logo-192.png should be removed')
  assert.ok(!fs.existsSync(path.join(iconsDir, 'logo-512.png')), 'legacy logo-512.png should be removed')
})

test('manifest.webmanifest has branding fields', () => {
  const raw = fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')
  const manifest = JSON.parse(raw)
  assert.ok(manifest.name)
  assert.ok(manifest.short_name)
  assert.ok(manifest.description)
  assert.equal(manifest.display, 'browser')
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2)
  assert.ok(manifest.icons.some(i => i.src === '/icons/icon-192.png' && i.sizes === '192x192' && i.purpose === 'any'))
  assert.ok(manifest.icons.some(i => i.src === '/icons/icon-512.png' && i.sizes === '512x512' && i.purpose === 'any'))
})

test('index.html declares Apple title, description, and touch icons', () => {
  const html = fs.readFileSync(indexHtml, 'utf8')
  assert.match(html, /name="description"[^>]*content="AI 投研 Agent · 交互式数据分析画布"/)
  assert.match(html, /name="apple-mobile-web-app-title"[^>]*content="Research Canvas"/)
  assert.match(html, /<title>Research Canvas<\/title>/)
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\/apple-touch-icon\.png"/)
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon\.png"/)
  assert.match(html, /rel="manifest"[^>]*href="\/manifest\.webmanifest"/)
})
