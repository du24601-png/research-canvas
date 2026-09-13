#!/usr/bin/env node
/**
 * Local smoke: query → preview → adopt → click-to-source → present → export.
 * Requires API (:8711) and Vite (:5173, WEB_HTTPS=0).
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.OPPTRIX_E2E_BASE ?? 'http://127.0.0.1:5173'
const QUERY = process.env.OPPTRIX_E2E_QUERY
  ?? '对比贵州茅台和五粮液2019到2024年净资产收益率'
const QUERY_TIMEOUT_MS = Number(process.env.OPPTRIX_E2E_QUERY_TIMEOUT_MS ?? 180_000)
const ASSET_DIR = process.env.OPPTRIX_E2E_SCREENSHOT_DIR
  ?? path.join(ROOT, 'docs', 'images')

function fail(message) {
  console.error(`[e2e] FAIL: ${message}`)
  process.exit(1)
}

function pass(message) {
  console.log(`[e2e] OK: ${message}`)
}

async function waitForQueryResult(page) {
  const deadline = Date.now() + QUERY_TIMEOUT_MS
  while (Date.now() < deadline) {
    const preview = page.locator('[data-research-preview]').last()
    if (await preview.count() === 0) {
      await page.waitForTimeout(1500)
      continue
    }
    const state = await preview.getAttribute('data-research-preview')
    if (state === 'error') {
      const text = await preview.innerText()
      fail(`preview error state: ${text.replace(/\s+/g, ' ').slice(0, 200)}`)
    }
    if (state === 'ready' || state === 'accepted') {
      const chart = preview.locator('canvas, svg')
      if (await chart.count() > 0) {
        return preview
      }
    }
    await page.waitForTimeout(1500)
  }
  fail(`timed out after ${QUERY_TIMEOUT_MS}ms waiting for chart preview`)
}

async function clickUntilCitation(page, host) {
  const box = await host.boundingBox()
  if (!box) fail('chart host has no bounding box')
  const offsets = [
    [0.28, 0.55],
    [0.42, 0.48],
    [0.58, 0.52],
    [0.72, 0.45],
    [0.35, 0.38],
  ]
  for (const [rx, ry] of offsets) {
    await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry)
    const citation = page.locator('[data-research-citation="true"]').last()
    try {
      await citation.waitFor({ state: 'visible', timeout: 1500 })
      return citation
    } catch {
      continue
    }
  }
  fail('clicking the chart did not open a source citation')
}

function assertCitationCopy(text) {
  const compact = text.replace(/\s+/g, ' ')
  if (/mixed|多个来源/i.test(compact)) {
    fail(`citation leaked mixed copy: ${compact.slice(0, 180)}`)
  }
  if (!compact.includes('来源：')) {
    fail(`citation missing source line: ${compact.slice(0, 180)}`)
  }
  if (compact.includes('这条没有单独来源')) {
    fail(`citation has no per-cell source: ${compact.slice(0, 180)}`)
  }
}

async function main() {
  await mkdir(ASSET_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  try {
    console.log(`[e2e] open ${BASE}`)
    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    if (!response || response.status() >= 500) {
      fail(`page load HTTP ${response?.status() ?? 'unknown'}`)
    }

    const titleMenu = page.getByRole('button', { name: /打开看板菜单/ })
    await titleMenu.waitFor({ state: 'visible', timeout: 60_000 })
    await titleMenu.click()
    await page.getByRole('button', { name: '新建对话', exact: true }).click()
    await page.locator('.opptrix-composer-editor[data-empty="true"]').waitFor({ state: 'visible', timeout: 15_000 })
    pass('started fresh session')

    const editor = page.locator('.opptrix-composer-editor')
    await editor.click()
    await editor.fill('')
    await page.keyboard.type(QUERY, { delay: 15 })
    await page.getByRole('button', { name: '发送' }).click()
    pass(`submitted query: ${QUERY}`)

    const preview = await waitForQueryResult(page)
    pass('preview chart rendered without missing-data error')
    await preview.screenshot({ path: path.join(ASSET_DIR, 'preview.png') })

    const adoptBtn = preview.getByRole('button', { name: '添加到画布' })
    await adoptBtn.click()
    await page.locator('[data-research-preview="accepted"]').last().waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    pass('adopted widget to canvas')

    const canvasRoot = page.locator('.research-canvas-root')
    const canvasChart = canvasRoot.locator('canvas, svg').first()
    await canvasChart.waitFor({ state: 'visible', timeout: 15_000 })
    pass('right canvas shows chart')

    const tableTab = canvasRoot.getByRole('tab', { name: '表格' })
    if (await tableTab.count() > 0) {
      await tableTab.click()
      const cell = canvasRoot.locator('td[title="点击查看数据依据"]').first()
      await cell.waitFor({ state: 'visible', timeout: 10_000 })
      await cell.click()
    } else {
      await clickUntilCitation(page, canvasChart)
    }

    const citation = page.locator('[data-research-citation="true"]').last()
    await citation.waitFor({ state: 'visible', timeout: 8_000 })
    const citationText = await citation.innerText()
    assertCitationCopy(citationText)
    pass(`source citation: ${citationText.replace(/\s+/g, ' ').slice(0, 120)}`)
    await canvasRoot.locator('.research-canvas-widget').first().screenshot({
      path: path.join(ASSET_DIR, 'source.png'),
    })

    const lineTab = canvasRoot.getByRole('tab', { name: '折线' })
    if (await lineTab.count() > 0) await lineTab.click()
    await page.waitForTimeout(400)

    const presentBtn = page.getByRole('button', { name: /演示/ }).first()
    await presentBtn.click()
    await page.waitForFunction(
      () => document.documentElement.dataset.opptrixPresent === '1',
      undefined,
      { timeout: 10_000 },
    )
    pass('present mode enabled')
    await canvasRoot.screenshot({ path: path.join(ASSET_DIR, 'canvas.png') })

    const exportLandscape = page.getByRole('button', { name: '导出横版' })
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 })
    await exportLandscape.click()
    const download = await downloadPromise
    const coverPath = path.join(ASSET_DIR, 'cover-16x9.png')
    await download.saveAs(coverPath)
    pass(`exported cover: ${coverPath}`)

    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => document.documentElement.dataset.opptrixPresent !== '1',
      undefined,
      { timeout: 10_000 },
    )
    pass('present mode exited with Esc')
    console.log('[e2e] ALL PASSED')
  } finally {
    await context.close()
    await browser.close()
  }
}

main().catch(err => {
  console.error('[e2e] ERROR:', err instanceof Error ? err.message : err)
  process.exit(1)
})
