import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchChartStyleEntityId,
  resolveChartStyleAgainstEntities,
  sanitizeChartStyle,
} from '../packages/shared/dist/research-chart-style.js'

const ENTITIES = [
  { id: 'CN:SZ.300750', name: '宁德时代', ticker: '300750.SZ' },
  { id: 'CN:SZ.002594', name: '比亚迪', ticker: '002594.SZ' },
]

describe('research chart style', () => {
  it('maps chinese and english color names to hex', () => {
    const style = sanitizeChartStyle({
      series: {
        a: { color: '蓝色' },
        b: { color: 'orange' },
        c: { color: '绿' },
      },
    })
    assert.equal(style?.series?.a?.color, '#2563EB')
    assert.equal(style?.series?.b?.color, '#EA580C')
    assert.equal(style?.series?.c?.color, '#16A34A')
  })

  it('matches company name, ticker and 6-digit code', () => {
    assert.equal(matchChartStyleEntityId('宁德时代', ENTITIES), 'CN:SZ.300750')
    assert.equal(matchChartStyleEntityId('300750.SZ', ENTITIES), 'CN:SZ.300750')
    assert.equal(matchChartStyleEntityId('002594', ENTITIES), 'CN:SZ.002594')
    assert.equal(matchChartStyleEntityId('CN:SZ.002594', ENTITIES), 'CN:SZ.002594')
  })

  it('folds natural-language series keys onto entity ids', () => {
    const style = sanitizeChartStyle({
      series: { 宁德: { color: '蓝' }, 比亚迪: { color: '橙' } },
    })
    const bound = resolveChartStyleAgainstEntities(style, ENTITIES)
    assert.equal(bound?.series?.['CN:SZ.300750']?.color, '#2563EB')
    assert.equal(bound?.series?.['CN:SZ.002594']?.color, '#EA580C')
  })
})
