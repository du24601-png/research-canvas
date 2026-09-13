/**
 * Tushare 服务地址解析 — 官方默认 + 自定义 http(s) 覆盖。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TUSHARE_DEFAULT_HTTP_URL,
  resolveTushareHttpUrl,
} from '../packages/a-stock-layer/dist/providers/tushare/config.js'
import { TUSHARE_SETTINGS } from '../packages/a-stock-layer/dist/providers/tushare/settings.js'

test('default http url is official Tushare Pro', () => {
  assert.equal(TUSHARE_DEFAULT_HTTP_URL, 'https://api.tushare.pro')
  assert.equal(resolveTushareHttpUrl(''), TUSHARE_DEFAULT_HTTP_URL)
  assert.equal(resolveTushareHttpUrl(null), TUSHARE_DEFAULT_HTTP_URL)
  assert.equal(resolveTushareHttpUrl(undefined), TUSHARE_DEFAULT_HTTP_URL)
})

test('keeps custom http and https endpoints', () => {
  assert.equal(
    resolveTushareHttpUrl('http://203.0.113.10:8020'),
    'http://203.0.113.10:8020',
  )
  assert.equal(
    resolveTushareHttpUrl('https://api.example.com/tushare/'),
    'https://api.example.com/tushare',
  )
})

test('rejects non-http schemes and invalid urls', () => {
  assert.equal(resolveTushareHttpUrl('ftp://example.com'), TUSHARE_DEFAULT_HTTP_URL)
  assert.equal(resolveTushareHttpUrl('not a url'), TUSHARE_DEFAULT_HTTP_URL)
})

test('settings expose optional service address field', () => {
  const field = TUSHARE_SETTINGS.fields.find(f => f.key === 'httpUrl')
  assert.ok(field)
  assert.equal(field.type, 'string')
  assert.equal(field.required, false)
})
