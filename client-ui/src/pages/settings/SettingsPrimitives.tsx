/**
 * SettingsPrimitives — 设置域标准分子件统一出口（L3）。
 *
 * 实现按族拆分在 `settings/primitives/`：
 *   surfaces.ts    — 表面常量（tint / 边框 / 圆角 / 投影）
 *   chrome.tsx     — Group / Card / SectionHeader / SectionLabel / EmptyState /
 *                    StaticBlock / Divider / PanelHeader
 *   rows.tsx       — Row / ActionRow / ExternalLinkRow
 *   inputs.tsx     — InlineInput / TextField / CredentialRow
 *   lists.tsx      — ListPanel / ListScroll / AddBar / ListRow
 *   providerRow.tsx— ProviderRow（大模型提供商行 + 模型列表 Dialog）
 *   feedback.tsx   — ModeTabs / Hint / ItemCard / StatusCard
 *
 * 对外导出名保持稳定：ui-kit（插件契约面）与各 Section 一律从本文件导入。
 */
export {
  settingsSurfaceTint,
  settingsHairlineBorder,
  settingsSurfaceRadius,
  settingsItemTint,
  settingsTabActiveShadow,
} from './primitives/surfaces'

export {
  SettingsGroup,
  SettingsCard,
  SettingsSectionHeader,
  SettingsSectionLabel,
  SettingsEmptyState,
  SettingsStaticBlock,
  SettingsDivider,
  SettingsPanelHeader,
} from './primitives/chrome'

export {
  SettingsRow,
  SettingsActionRow,
  SettingsExternalLinkRow,
} from './primitives/rows'

export {
  SettingsInlineInput,
  SettingsTextField,
  SettingsCredentialRow,
} from './primitives/inputs'

export {
  SettingsListPanel,
  SettingsListScroll,
  SettingsAddBar,
  SettingsListRow,
} from './primitives/lists'

export { SettingsProviderRow } from './primitives/providerRow'

export {
  SettingsModeTabs,
  SettingsHint,
  SettingsItemCard,
  SettingsStatusCard,
} from './primitives/feedback'
