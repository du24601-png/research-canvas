import { describe, expect, it } from 'vitest'
import { getResearchChartTheme } from '../chartTheme'
import { MOCK_GROSS_MARGIN_DATASET } from '../mockGrossMarginDataset'
import type { WidgetType } from '../types'
import { buildVegaSpec } from './buildVegaSpec'

const TYPES: WidgetType[] = [
  'line_chart', 'bar_chart', 'grouped_bar', 'stacked_bar', 'stacked_bar_percent',
  'combo_bar_line', 'pie_chart', 'donut_chart', 'heatmap_table',
]

describe('vega rendering (headless, CSP-safe interpreter)', () => {
  it.each(TYPES)('%s compiles and renders to SVG', async type => {
    const [vega, vegaLite, interpreter] = await Promise.all([
      import('vega'), import('vega-lite'), import('vega-interpreter'),
    ])
    const built = buildVegaSpec({
      type, dataset: MOCK_GROSS_MARGIN_DATASET, theme: getResearchChartTheme('dark'), mode: 'wide',
    })
    expect(built).not.toBeNull()
    const sized = { ...built?.spec, width: 640, height: 320 }
    const compiled = vegaLite.compile(sized as unknown as Parameters<typeof vegaLite.compile>[0]).spec
    const runtime = vega.parse(compiled, undefined, { ast: true })
    const view = new vega.View(runtime, { renderer: 'none', expr: interpreter.expressionInterpreter })
    const svg = await view.toSVG()
    expect(svg).toContain('<svg')
    view.finalize()
  }, 60_000)
})
