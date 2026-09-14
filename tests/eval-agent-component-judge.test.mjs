/**
 * Agent 组件评测判分器：按 gold 比对工具名与参数。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { judgeComponentCase } from '../eval/agent/component/judge.mjs'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../eval/agent/component')

async function loadCase(file, id) {
  const pack = JSON.parse(await readFile(path.join(DIR, file), 'utf8'))
  const found = pack.cases.find((c) => c.id === id)
  assert.ok(found, id)
  return found
}

test('must_not_call passes when the model calls nothing', async () => {
  const c = await loadCase('cases-negative.json', 'ng-001')
  const r = judgeComponentCase(c, { calls: [] })
  assert.equal(r.pass, true)
  assert.equal(r.caseId, 'ng-001')
})

test('must_not_call fails on any tool including ask_user', async () => {
  const c = await loadCase('cases-negative.json', 'ng-001')
  const r = judgeComponentCase(c, { calls: [{ name: 'ask_user', args: { prompt: 'hi' } }] })
  assert.equal(r.pass, false)
  assert.ok(r.reasons.length > 0)
})

test('query_data matches aliases, years, and forbids financials', async () => {
  const c = await loadCase('cases-query-canvas-a.json', 'qc-001')
  const pass = judgeComponentCase(c, {
    calls: [{
      name: 'query_data',
      args: {
        entities: ['赛轮', '601966', '森麒麟'],
        metric: 'gross_margin',
        start: '2021',
        end: '2025',
      },
    }],
  })
  assert.equal(pass.pass, true)

  const wrongMetric = judgeComponentCase(c, {
    calls: [{
      name: 'query_data',
      args: { entities: ['赛轮', '玲珑', '森麒麟'], metric: 'roe', start: '2021', end: '2025' },
    }],
  })
  assert.equal(wrongMetric.pass, false)

  const forbidden = judgeComponentCase(c, {
    calls: [{ name: 'get_instrument_financials', args: { code: '601058' } }],
  })
  assert.equal(forbidden.pass, false)

  const missingCo = judgeComponentCase(c, {
    calls: [{
      name: 'query_data',
      args: { entities: ['赛轮', '玲珑'], metric: 'gross_margin', start: '2021', end: '2025' },
    }],
  })
  assert.equal(missingCo.pass, false)
})

test('confirmed:true fails absent_or_false; search_instruments may precede', async () => {
  const c = await loadCase('cases-query-canvas-a.json', 'qc-001')
  const confirmed = judgeComponentCase(c, {
    calls: [{
      name: 'query_data',
      args: {
        entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
        metric: 'gross_margin',
        start: '2021',
        end: '2025',
        confirmed: true,
      },
    }],
  })
  assert.equal(confirmed.pass, false)

  const prelude = judgeComponentCase(c, {
    calls: [
      { name: 'search_instruments', args: { keyword: '赛轮' } },
      {
        name: 'query_data',
        args: {
          entities: ['赛轮轮胎', '玲珑轮胎', '森麒麟'],
          metric: 'gross_margin',
          start: '2021',
          end: '2025',
        },
      },
    ],
  })
  assert.equal(prelude.pass, true)
})

test('quotes symbol_any reads instruments[].symbol', async () => {
  const c = await loadCase('cases-query-quotes.json', 'qq-002')
  const r = judgeComponentCase(c, {
    calls: [{
      name: 'get_instrument_quotes',
      args: { instruments: [{ market: 'CN', symbol: '600519', exchange: 'SH' }] },
    }],
  })
  assert.equal(r.pass, true)
})

test('industry contains_any and query_data is forbidden on first turn', async () => {
  const c = await loadCase('cases-query-gates.json', 'qg-001')
  const ok = judgeComponentCase(c, {
    calls: [{ name: 'resolve_industry_universe', args: { industry: '动力电池' } }],
  })
  assert.equal(ok.pass, true)
  const leak = judgeComponentCase(c, {
    calls: [{
      name: 'query_data',
      args: { entities: ['宁德时代'], metric: 'revenue', start: '2021', end: '2025' },
    }],
  })
  assert.equal(leak.pass, false)
})

test('max_calls is enforced', async () => {
  const c = await loadCase('cases-query-quotes.json', 'qq-002')
  const r = judgeComponentCase(c, {
    calls: [
      { name: 'get_instrument_quotes', args: { instruments: [{ market: 'CN', symbol: '600519' }] } },
      { name: 'get_instrument_snapshot', args: { code: '600519' } },
      { name: 'ask_user', args: { prompt: '还要看什么' } },
    ],
  })
  assert.equal(r.pass, false)
  assert.ok(r.reasons.some((x) => /max_calls/.test(x)))
})

test('accepts OpenAI tool_call shape with JSON arguments string', async () => {
  const c = await loadCase('cases-query-quotes.json', 'qq-002')
  const r = judgeComponentCase(c, {
    calls: [{
      function: {
        name: 'get_instrument_quotes',
        arguments: JSON.stringify({ instruments: [{ market: 'CN', symbol: '600519' }] }),
      },
    }],
  })
  assert.equal(r.pass, true)
})
