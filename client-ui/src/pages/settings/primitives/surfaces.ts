/**
 * 设置域表面常量 — SettingsPrimitives 各分子件共用（Cursor settings 视觉基准）。
 * 只允许引用 theme tokens / CSS 变量；禁止裸 hex。
 */

/** Cursor settings sub-section tint (`--cursor-bg-quinary` ≈ ink 4%). */
export const settingsSurfaceTint = 'color-mix(in srgb, var(--opptrix-text-primary) 4%, transparent)'
export const settingsHairlineBorder = `1px solid ${settingsSurfaceTint}`
/** Group / list panel corner radius (Cursor sub-section-list)。 */
export const settingsSurfaceRadius = '12px'

/** 列表条目 / 摘要卡的浅底（比 surface tint 再浅一档，ink 3%）。 */
export const settingsItemTint = 'color-mix(in srgb, var(--opptrix-text-primary) 3%, transparent)'

/** 模式 Tab 激活态投影 — 设置区多视图切换的统一抬升。 */
export const settingsTabActiveShadow = '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)'
