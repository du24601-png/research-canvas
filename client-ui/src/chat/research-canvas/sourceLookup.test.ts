import { describe, expect, it } from 'vitest'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import {
  cellNumericValue,
  entityNameForId,
  findSourceForCell,
  formatCellValue,
} from './sourceLookup'

describe('sourceLookup', () => {
  it('finds exact entity-period sources and formats cell values', () => {
    const entityId = MOCK_GROSS_MARGIN_DATASET.entities[0]?.id ?? ''
    expect(entityNameForId(MOCK_GROSS_MARGIN_DATASET, entityId)).toBe('赛轮轮胎')
    expect(cellNumericValue(MOCK_GROSS_MARGIN_DATASET, entityId, '2023')).toBe(19.1)
    expect(formatCellValue(MOCK_GROSS_MARGIN_DATASET, 19.1)).toBe('19.1%')
    expect(formatCellValue(MOCK_GROSS_MARGIN_DATASET, null)).toBe('—')
    expect(findSourceForCell(MOCK_GROSS_MARGIN_DATASET, entityId, '2023')?.metric).toBe('gross_margin')
  })

  it('does not reuse another period source when exact match is missing', () => {
    const entityId = MOCK_GROSS_MARGIN_DATASET.entities[0]?.id ?? ''
    expect(findSourceForCell(MOCK_GROSS_MARGIN_DATASET, entityId, '2024')).toBeUndefined()
  })

  it('returns undefined when no source is recorded for the entity', () => {
    const dataset = {
      ...MOCK_GROSS_MARGIN_DATASET,
      sources: [],
    }
    const entityId = dataset.entities[0]?.id ?? ''
    expect(findSourceForCell(dataset, entityId, '2023')).toBeUndefined()
  })

  it('ignores mixed provider rows', () => {
    const entityId = MOCK_GROSS_MARGIN_DATASET.entities[0]?.id ?? ''
    const dataset = {
      ...MOCK_GROSS_MARGIN_DATASET,
      sources: [{
        provider: 'mixed',
        entityId,
        metric: 'gross_margin',
        period: '2023',
        fetchedAt: '2026-01-01T00:00:00.000Z',
      }],
    }
    expect(findSourceForCell(dataset, entityId, '2023')).toBeUndefined()
  })
})
