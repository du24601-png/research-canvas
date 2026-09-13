import type { Dataset } from './types'

const LEGACY_ENTITIES = [
  { id: 'legacy-sailun', name: '赛轮轮胎', ticker: '601058.SH' },
  { id: 'legacy-linglong', name: '玲珑轮胎', ticker: '601966.SH' },
  { id: 'legacy-sentury', name: '森麒麟', ticker: '002283.SZ' },
] as const

const LEGACY_VALUES: Record<string, number[]> = {
  'legacy-sailun': [18.2, 17.5, 19.1, 20.3, 21.0],
  'legacy-linglong': [15.8, 14.9, 16.2, 17.1, 17.8],
  'legacy-sentury': [22.1, 21.5, 23.0, 24.2, 25.1],
}

const PERIODS = ['2021', '2022', '2023', '2024', '2025'] as const

/** Phase 2 固定 mock：仅作为 v1 画布 fallback，真实 query_data 不得复用此 id。 */
export const MOCK_GROSS_MARGIN_DATASET: Dataset = {
  id: 'ds-tire-gross-margin-2021-2025',
  title: '轮胎企业毛利率比较',
  metric: 'gross_margin',
  unit: '%',
  entities: LEGACY_ENTITIES.map(item => ({
    id: item.id,
    name: item.name,
    ticker: item.ticker,
    market: 'CN',
    type: 'equity',
  })),
  periods: [...PERIODS],
  data: LEGACY_ENTITIES.flatMap(item => PERIODS.map((period, index) => ({
    entityId: item.id,
    period,
    value: LEGACY_VALUES[item.id]?.[index] ?? null,
  }))),
  sources: [{
    provider: 'unknown',
    entityId: LEGACY_ENTITIES[0].id,
    metric: 'gross_margin',
    period: '2023',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    fieldLabel: '毛利率',
  }],
}

export const MOCK_DATASETS: readonly Dataset[] = [MOCK_GROSS_MARGIN_DATASET]

