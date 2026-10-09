/**
 * 内部产品名：进入系统提示词（「你是…研究助手」）、TOTP issuer、服务端 app 标识。
 * 改它会改变 Agent 行为与已有验证器显示，改名前先跑 eval。
 */
export const PRODUCT_BRAND = {
  name: 'Research Canvas',
  shortName: 'Research Canvas',
  description: 'AI 投研 Agent · 交互式数据分析画布',
} as const

/**
 * 对外品牌：页面标题、manifest、登录页、侧栏、空状态等用户可见外壳。
 * 包名、数据目录、工具名不随之改名（FinFrame M3a，2026-10-09）。
 */
export const OUTWARD_BRAND = {
  name: 'FinFrame',
  shortName: 'FinFrame',
  description: 'AI 投研对话 · 每个数字都能点开看来源',
} as const

export interface ProductBrand {
  readonly name: string
  readonly shortName: string
  readonly description: string
}
