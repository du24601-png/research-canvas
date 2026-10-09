#!/usr/bin/env node
/**
 * 生成 seed-v2（30 题，§4.3 五个切片各 6 题）。seed-v1 不动。
 * 数值夹具用 snapshot 模式：快照覆盖的公司 / 指标 / 年份用真实值，其余合成。
 * 用法：node eval/finframe/cases/build-seed-v2.mjs
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const NO_WEB = { id: 'no_web', type: 'forbid_tool', tools: ['web_search'] }
const NO_CANVAS = { id: 'no_report_canvas', type: 'forbid_tool', tools: ['create_canvas'] }
const NO_FIN = { id: 'no_financials', type: 'forbid_tool', tools: ['get_instrument_financials'] }
const NO_REQUERY = { id: 'no_requery', type: 'forbid_tool', tools: ['query_data'] }
const BASE = [NO_WEB, NO_CANVAS]
const any = (...names) => ({ any: names })
const MT = any('贵州茅台', '茅台', '600519'), WLY = any('五粮液', '000858')
const CHART = ['ComparisonView', 'TrendView']
const ds = (id, metric, names, start, end) => ({ id, metric, title: `${names.join('、')} ${metric}`, entityNames: names, periodRange: `${start}–${end}`, seed: { entities: names, metric, start, end } })
const ctx = (d) => ({ datasets: [d], proposals: [{ id: 'prop-1', type: 'line_chart', title: d.title, datasetId: d.id }], widgets: [] })
const chain = (...steps) => steps
const q = (args) => ({ name: 'query_data', ...(args ? { args } : {}) })
const P = { name: 'propose_widget' }
const ui = (extra = {}) => ({ any_of: CHART, evidence: true, ...extra })

function c(id, slice, task, expect, gold, more = {}) {
  return { id, split: 'seed', slice, toolset: 'component_v1', task, expect, user_script: [], constraints: BASE, difficulty: 'medium', gold, ...more }
}

const S1 = 'basic_compare', S2 = 'decompose_evidence', S3 = 'multi_turn', S4 = 'ambiguity_missing', S5 = 'tool_degrade'

const cases = [
  c('v2-01', S1, '对比贵州茅台和五粮液最近五个已披露完整财年的净利率与 ROE。', 'answer', { chain: chain(q({ entities: { covers: [MT, WLY] }, start: { eq: '2021' }, end: { eq: '2025' } }), q({ entities: { covers: [MT, WLY] } }), P), max_decisions: 6 }, { source_ref: 'Demo A', ui_expect: { any_of: ['ComparisonView'], evidence: true } }),
  c('v2-02', S1, '招商银行和平安银行近五年 ROE 对比', 'answer', { chain: chain(q({ metric: { eq: 'roe' } }), P), max_decisions: 4 }, { ui_expect: ui() }),
  c('v2-03', S1, '宁德时代和比亚迪 2021 到 2025 年毛利率', 'answer', { chain: chain(q({ metric: { eq: 'gross_margin' }, start: { eq: '2021' }, end: { eq: '2025' } }), P), max_decisions: 4 }, { ui_expect: ui() }),
  c('v2-04', S1, '中芯国际和华虹公司 2021 到 2025 年净利率', 'answer', { chain: chain(q({ metric: { eq: 'net_margin' } }), P), max_decisions: 4 }, { ui_expect: ui() }),
  c('v2-05', S1, '看一下海天味业 2021 到 2025 年净资产收益率走势', 'answer', { chain: chain(q({ metric: { eq: 'roe' } }), P), max_decisions: 4 }, { ui_expect: { any_of: ['TrendView', 'ComparisonView'], evidence: true } }),
  c('v2-06', S1, '比较中国平安和招商银行 2021 到 2025 年 ROE', 'answer', { chain: chain(q({ metric: { eq: 'roe' }, entities: { covers: [any('中国平安', '601318'), any('招商银行', '招行', '600036')] } }), P), max_decisions: 4 }, { ui_expect: ui() }),

  c('v2-07', S2, '对比贵州茅台和五粮液的近五年净利率和 ROE，找出变化明显的年份。再解释哪些结论有数据支持，并给我打开来源核对。', 'answer', { chain: chain(q(), P), max_decisions: 8 }, { source_ref: 'brief S1', difficulty: 'hard', constraints: [...BASE, NO_FIN], ui_expect: ui({ highlight: true }) }),
  c('v2-08', S2, '海天味业近三年的盈利能力下滑，究竟是净利率变化、资产周转还是杠杆的贡献？与五粮液对比后，给出已经验证和仍需验证的假设。', 'answer', { chain: chain(q(), P), max_decisions: 8 }, { source_ref: 'brief S2', difficulty: 'hard', ui_expect: ui() }),
  c('v2-09', S2, '宁德时代 2022 到 2025 年净利率变化，是毛利率还是费用导致的？', 'answer', { chain: chain(q(), P), max_decisions: 6 }, { difficulty: 'hard', ui_expect: ui() }),
  c('v2-10', S2, '比亚迪 2021 到 2025 年 ROE 为什么起伏这么大', 'answer', { chain: chain(q({ metric: { eq: 'roe' } }), P), max_decisions: 6 }, { difficulty: 'hard', ui_expect: ui() }),
  c('v2-11', S2, '拆一下贵州茅台近五年 ROE 的变化原因', 'answer', { chain: chain(q(), P), max_decisions: 6 }, { difficulty: 'hard', ui_expect: ui() }),
  c('v2-12', S2, '招商银行 2021 到 2025 年净利率与 ROE，哪些结论有数据支持，哪些只是推测？', 'answer', { chain: chain(q(), P), max_decisions: 6 }, { difficulty: 'hard', ui_expect: ui() }),

  c('v2-13', S3, '对比贵州茅台和五粮液 2021 到 2025 年净利率', 'answer', { chain: chain(q({ metric: { eq: 'net_margin' } }), P, { name: 'refine_dataset', args: { operation_type: { eq: 'change_period' }, start: { eq: '2023' } } }, P), max_decisions: 8 }, { source_ref: 'Demo B', max_rounds: 12, user_script: [{ when: 'tool_idle', tool: 'propose_widget', content: '只看近三年，为什么其中一家的净利率变化比另一家更明显？' }], ui_expect: ui() }),
  c('v2-14', S3, '不要泸州老窖了，只留另外两家', 'answer', { chain: chain({ name: 'refine_dataset', args: { operation_type: { eq: 'remove_entities' } } }, P), max_decisions: 3 }, { context: ctx(ds('research-ds-1', 'net_margin', ['贵州茅台', '五粮液', '泸州老窖'], '2021', '2025')), constraints: [...BASE, NO_REQUERY], ui_expect: ui() }),
  c('v2-15', S3, '加上比亚迪一起比', 'answer', { chain: chain({ name: 'refine_dataset', args: { operation_type: { eq: 'add_entities' } } }, P), max_decisions: 4 }, { context: ctx(ds('research-ds-1', 'gross_margin', ['宁德时代', '中芯国际'], '2021', '2025')), ui_expect: ui() }),
  c('v2-16', S3, '改看净利率', 'answer', { chain: chain(q({ metric: { eq: 'net_margin' }, entities: { covers: [MT, WLY] } }), P), max_decisions: 4 }, { context: ctx(ds('research-ds-1', 'roe', ['贵州茅台', '五粮液'], '2021', '2025')), constraints: [...BASE, { id: 'no_refine_for_metric', type: 'forbid_tool', tools: ['refine_dataset'] }], ui_expect: ui() }),
  c('v2-17', S3, '继续查证据：毛利率也看一下', 'answer', { chain: chain(q({ metric: { eq: 'gross_margin' } }), P), max_decisions: 4 }, { context: ctx(ds('research-ds-1', 'net_margin', ['海天味业', '五粮液'], '2021', '2025')), ui_expect: ui() }),
  c('v2-18', S3, '只看 2023 年以后', 'answer', { chain: chain({ name: 'refine_dataset', args: { operation_type: { eq: 'change_period' }, start: { eq: '2023' } } }, P), max_decisions: 3 }, { context: ctx(ds('research-ds-1', 'gross_margin', ['中芯国际', '华虹公司'], '2021', '2025')), constraints: [...BASE, NO_REQUERY], ui_expect: ui() }),

  c('v2-19', S4, '看一下平安近五年的 ROE', 'clarify', { chain: [], optional: ['ask_user'], max_decisions: 2 }, { source_ref: 'Demo C（歧义）' }),
  c('v2-20', S4, '看贵州茅台 2026 年全年净利率', 'refuse', { chain: [], optional: ['query_data', 'propose_widget'], max_decisions: 3 }, { source_ref: 'Demo C（时点）', max_calls: 3 }),
  c('v2-21', S4, '比较中芯国际和华虹公司 2019 到 2025 年毛利率', 'answer_with_gap', { chain: chain(q({ metric: { eq: 'gross_margin' } }), P), max_decisions: 4 }, { source_ref: 'Demo C（缺数：华虹 2020 无数据，合成夹具标为缺失；2019 在快照外为合成值）', ui_expect: ui({ missing: true }) }),
  c('v2-22', S4, '招商银行近五年毛利率', 'refuse', { chain: [], optional: ['query_data'], max_decisions: 3 }, { source_ref: '口径：银行没有毛利率（快照里为 null）', max_calls: 3 }),
  c('v2-23', S4, '看一下招商银行近五年净息差走势', 'refuse', { chain: [], optional: ['ask_user'], max_decisions: 1 }, { source_ref: 'pl-023 同型：不支持的指标', constraints: [...BASE, { id: 'no_fake_metric', type: 'forbid_tool', tools: ['query_data'] }] }),
  c('v2-24', S4, '比较苹果和腾讯控股 2020 到 2024 年营收', 'refuse', { chain: [], max_decisions: 3 }, { source_ref: 'Demo C（美港股）', max_calls: 3 }),

  c('v2-25', S5, '对比贵州茅台和五粮液近五年 ROE', 'answer', { chain: chain(q({ metric: { eq: 'roe' } }), P), max_decisions: 5 }, { source_ref: '数据源第一次超时，重试成功', faults: [{ tool: 'query_data', calls: [1], result: { error: '数据源暂时超时，请稍后重试' } }], ui_expect: ui() }),
  c('v2-26', S5, '对比贵州茅台和五粮液近五年净利率', 'refuse', { chain: [], optional: ['query_data'], max_decisions: 3 }, { source_ref: '数据源持续超时：如实说明，不反复重试', max_calls: 3, faults: [{ tool: 'query_data', calls: 'all', result: { error: '数据源暂时超时，请稍后重试' } }] }),
  c('v2-27', S5, '把刚才那张图改成柱状图', 'answer', { chain: chain(q(), P), max_decisions: 4 }, { source_ref: '错误数据集 id：预览引用的数据集已不存在，需重新取数', context: { datasets: [{ id: 'research-ds-7', metric: 'roe', title: '贵州茅台、五粮液 roe', entityNames: ['贵州茅台', '五粮液'], periodRange: '2021–2025' }], proposals: [{ id: 'prop-1', type: 'line_chart', title: '贵州茅台、五粮液 roe', datasetId: 'research-ds-7' }], widgets: [] }, ui_expect: ui() }),
  c('v2-28', S5, '茅台和五粮液的净利率，再看看走势', 'answer', { chain: chain(P), max_decisions: 2 }, { source_ref: '重复调用陷阱：已有数据集只换视图，不再取数', context: ctx(ds('research-ds-1', 'net_margin', ['贵州茅台', '五粮液'], '2021', '2025')), constraints: [...BASE, NO_REQUERY] }),
  c('v2-29', S5, '只看 2023 年以后', 'answer', { chain: [], optional: ['refine_dataset', 'query_data', 'propose_widget'], max_decisions: 4 }, { source_ref: '派生失败：refine 报错后改用重新取数或如实说明', context: ctx(ds('research-ds-1', 'roe', ['贵州茅台', '五粮液'], '2021', '2025')), faults: [{ tool: 'refine_dataset', calls: 'all', result: { error: '数据层暂时不可用，请稍后再试' } }] }),
  c('v2-30', S5, '对比贵州茅台和五粮液近五年 ROE，数据要和年报口径一致', 'answer', { chain: chain(q({ metric: { eq: 'roe' } }), P), max_decisions: 4 }, { source_ref: 'F4 诱因：不要再用 get_instrument_financials 补数', constraints: [...BASE, NO_FIN], ui_expect: ui() }),
]

const pack = {
  file: 'seed-v2.json',
  dataset_id: 'finframe-seed-v2',
  fixture_version: 'finframe-synth-v1',
  fixture_mode: 'snapshot',
  as_of: '2026-10-09',
  notes: '30 题，§4.3 五个切片各 6 题。数值夹具 snapshot 模式：snapshot-v1 覆盖的 11 家 × 净利率/ROE/毛利率 × 2021–2025 用真实值（含银行毛利率的真实 null），其余合成。faults 为故障注入。seed-v1 保持不变。',
  cases,
}
writeFileSync(path.join(DIR, 'seed-v2.json'), `${JSON.stringify(pack, null, 2)}\n`)
console.log(`${cases.length} cases`, Object.entries(cases.reduce((m, x) => ({ ...m, [x.slice]: (m[x.slice] ?? 0) + 1 }), {})).map(([k, v]) => `${k}=${v}`).join(' '))
