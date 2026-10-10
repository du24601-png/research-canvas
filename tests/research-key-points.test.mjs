/**
 * FinFrame KeyPoints：要点由代码从 Dataset 算出、按固定优先级挑选、措辞固定；同样输入永远同样输出。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeKeyPoints,
  extremeSignal,
  gapSignal,
  largestChangeSignal,
  missingSignal,
  streakSignal,
} from '../packages/shared/dist/research-key-points.js'
import { findDigitLeak, tokenizeNumberSentence } from '../packages/shared/dist/research-ui-spec-text.js'

const A = { id: 'CN:SH.600519', name: '甲', ticker: '600519.SH', market: 'CN', type: 'equity' }
const B = { id: 'CN:SZ.000858', name: '乙', ticker: '000858.SZ', market: 'CN', type: 'equity' }
const PERIODS = ['2021', '2022', '2023', '2024', '2025']

function ds(id, metric, unit, values, entities = [A, B]) {
  const data = entities.flatMap(e => PERIODS.map((period, i) => ({ entityId: e.id, period, value: values[e.id]?.[i] ?? null })))
  return { id, title: id, metric, unit, entities, periods: PERIODS, data, sources: [] }
}

const NM = ds('research-ds-nm', 'net_margin', '%', { [A.id]: [40, 41, 42, 44, 45], [B.id]: [30, 32, 33, 35, 31] })
const ROE = ds('research-ds-roe', 'roe', '%', { [A.id]: [28, 27, 29, 31, 32], [B.id]: [null, 23, 25, 24, 20] })

test('extreme: latest is strictly highest / lowest over ≥3 filled periods', () => {
  const high = extremeSignal(NM, A.id)
  assert.equal(high.kind, 'extreme')
  assert.deepEqual(high.refs, [{ entityId: A.id, period: '2025' }])
  assert.match(high.template, /2021–2025 年的最高值/)
  assert.match(extremeSignal(ROE, B.id).template, /2022–2025 年的最低值/)
  assert.equal(extremeSignal(NM, B.id), null)
  const flat = ds('research-ds-flat', 'net_margin', '%', { [A.id]: [null, null, null, 5, 6] }, [A])
  assert.equal(extremeSignal(flat, A.id), null)
})

test('streak: N≥2 consecutive moves ending at the latest filled period', () => {
  const up = streakSignal(NM, A.id)
  assert.equal(up.kind, 'streak')
  assert.deepEqual(up.periods, ['2021', '2025'])
  assert.match(up.template, /连续 4 年上升/)
  const down = streakSignal(ROE, B.id)
  assert.deepEqual(down.periods, ['2023', '2025'])
  assert.match(down.template, /连续 2 年下降/)
  assert.equal(streakSignal(NM, B.id), null)
})

test('gap: widening / narrowing / flipped between first and last common periods', () => {
  const g = gapSignal(NM)
  assert.match(g.template, /扩大/)
  assert.deepEqual(g.periods, ['2021', '2025'])
  const narrow = ds('research-ds-n', 'roe', '%', { [A.id]: [10, 10, 10], [B.id]: [5, 6, 8] })
  assert.match(gapSignal(narrow).template, /收窄/)
  const flip = ds('research-ds-f', 'roe', '%', { [A.id]: [10, 10, 10], [B.id]: [5, 6, 12] })
  assert.match(gapSignal(flip).template, /高低位置互换/)
  const same = ds('research-ds-s', 'roe', '%', { [A.id]: [10, 11, 12], [B.id]: [5, 6, 7] })
  assert.equal(gapSignal(same), null)
  assert.equal(gapSignal(ds('research-ds-one', 'roe', '%', { [A.id]: [1, 2, 3] }, [A])), null)
})

test('largest change reuses yoy delta and cites both periods', () => {
  const big = largestChangeSignal(NM)
  assert.deepEqual(big.refs, [{ entityId: B.id, period: '2024' }, { entityId: B.id, period: '2025' }])
  assert.match(big.template, /\{largestChange\}/)
})

test('missing counts cells, never fills them', () => {
  const m = missingSignal([ROE])
  assert.equal(m.kind, 'missing')
  assert.deepEqual(m.entityIds, [B.id])
  assert.deepEqual(m.periods, ['2021'])
  assert.match(m.template, /有 1 处数据没有取到/)
  assert.equal(missingSignal([NM]), null)
})

test('computeKeyPoints: at most 3, fixed priority, missing keeps one slot, deterministic', () => {
  const points = computeKeyPoints([NM, ROE])
  assert.equal(points.length, 3)
  assert.deepEqual(points.map(p => p.kind), ['extreme', 'extreme', 'missing'])
  assert.deepEqual(points.map(p => p.datasetId), [NM.id, ROE.id, ROE.id])
  assert.deepEqual(computeKeyPoints([NM, ROE]), points)
  const only = computeKeyPoints([NM])
  assert.deepEqual(only.map(p => p.kind), ['extreme', 'gap', 'largest_change'])
  // 同一数据集同一实体的 extreme / streak 只留一条
  const keys = only.map(p => `${p.datasetId}|${p.entityIds.join()}|${p.kind === 'streak' ? 'extreme' : p.kind}`)
  assert.equal(new Set(keys).size, keys.length)
})

test('templates only carry numbers via placeholders, apart from code-counted years', () => {
  for (const point of computeKeyPoints([NM, ROE])) {
    const tokens = tokenizeNumberSentence(point.template)
    assert.ok(tokens.every(t => t.kind !== 'text' || !/[{}]/.test(t.text)), point.template)
    if (point.kind === 'extreme') assert.equal(findDigitLeak(point.template, PERIODS), null)
  }
})

test('kline or non-year periods produce no key points', () => {
  const kline = { ...NM, id: 'research-ds-k', metric: 'kline' }
  assert.deepEqual(computeKeyPoints([kline]), [])
  const quarterly = { ...NM, id: 'research-ds-q', periods: ['2025Q1', '2025Q2'] }
  assert.deepEqual(computeKeyPoints([quarterly]), [])
  assert.deepEqual(computeKeyPoints([]), [])
})

test('missing notice aggregates every dataset with gaps, naming each metric', () => {
  const GM = ds('research-ds-gm', 'gross_margin', '%', { [A.id]: [null, null, 50, 51, 52], [B.id]: [40, 41, 42, 43, 44] })
  const m = missingSignal([NM, GM, ROE])
  assert.deepEqual(m.datasetIds, [GM.id, ROE.id])
  assert.match(m.template, /^毛利率有 2 处、净资产收益率有 1 处数据没有取到/)
  const points = computeKeyPoints([GM, ROE])
  assert.equal(points.length, 3)
  assert.equal(points.filter(p => p.kind === 'missing').length, 1)
})

test('streak needs adjacent calendar years; a gap in years breaks the run', () => {
  const gappy = { ...ds('research-ds-y', 'roe', '%', { [A.id]: [10, 11, 12, 13] }, [A]), periods: ['2019', '2020', '2022', '2023'] }
  gappy.data = gappy.periods.map((period, i) => ({ entityId: A.id, period, value: [10, 11, 12, 13][i] }))
  assert.equal(streakSignal(gappy, A.id), null)
  const two = { ...gappy, periods: ['2019', '2021', '2022', '2023'], data: ['2019', '2021', '2022', '2023'].map((period, i) => ({ entityId: A.id, period, value: [10, 11, 12, 13][i] })) }
  assert.deepEqual(streakSignal(two, A.id).periods, ['2021', '2023'])
})

test('signals compare displayed (rounded) values, never raw ones', () => {
  // 12.04 → 12.02 都显示 12.0：不算上升；最新值显示与前一年相同也不算最高
  const flat = ds('research-ds-r', 'roe', '%', { [A.id]: [11, 12.04, 12.02] }, [A])
  assert.equal(streakSignal(flat, A.id), null)
  assert.equal(extremeSignal(flat, A.id), null)
  // 差距 1.04 → 1.01 都显示 +1.0：不算收窄
  const gap = ds('research-ds-g', 'roe', '%', { [A.id]: [11.04, 11.01], [B.id]: [10, 10] })
  assert.equal(gapSignal(gap), null)
  // −0.01 显示为 −0.01、0.001 显示为 0：不算反向
  const flip = ds('research-ds-z', 'roe', '%', { [A.id]: [10.04, 10.001], [B.id]: [10.05, 10] })
  assert.notEqual(gapSignal(flip)?.template.includes('互换'), true)
  // 同比变化显示为零 → 不报「变化最大」
  const tiny = ds('research-ds-t', 'roe', '%', { [A.id]: [10, 10.001, 10.002] }, [A])
  assert.equal(largestChangeSignal(tiny), null)
})
