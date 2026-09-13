/**
 * User-facing product brand. Change this file (and HTML/manifest via tests) to rename.
 */
export const PRODUCT_BRAND = {
  name: 'Research Canvas',
  shortName: 'Research Canvas',
  description: 'AI 投研 Agent · 交互式数据分析画布',
} as const

export type ProductBrand = typeof PRODUCT_BRAND
