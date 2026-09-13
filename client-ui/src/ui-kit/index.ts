/**
 * @opptrix/ui-kit — 插件组件契约 v1（Opptrix 与第三方扩展的统一组件出口）。
 *
 * 这是 STABLE 组件面：扩展作者一律从此命名空间导入（打包应用可深层导入，
 * 但只有本命名空间是受支持契约）。分层规则：
 *   L1 原子 — components/opptrix/*，无业务语义（按钮/输入/空态等）；
 *   标准件 — SettingsPrimitives 设置域标准分子件（面板布局词汇表）；
 *   工具   — listRowKey / formatBytes 等纯函数；
 *   tokens — opptrixCssVars / designTokens（主题消费契约）。
 * 所有实现主题 token 驱动 —— 本目录（零容忍区）无裸色值/裸 px 字号，
 * `tests/ui-token-lint.test.mjs` 强制执行。
 *
 * Typography contract (consumes `opptrixCssVars`):
 *   pageTitle 17/500 · pageSubtitle 13/400 · sectionLabel 12/600 uppercase
 *   body 14/400 · bodyStrong 14/600 · caption 12/400
 *
 * Spacing/radius/motion: consume `designTokens` (theme/design-tokens) —
 * semantic layer first (`semantic.*`), primitives only in ui-kit internals.
 */

// ─── L1 原子：交互与输入（既有 Opptrix 封装为唯一实现源；深层导入仅为旧调用点保留） ───
// 主按钮/次按钮/图标按钮（统一 Opptrix 视觉与可访问性）
export { default as Button } from '../components/opptrix/OpptrixButton'
// 单行文本输入
export { default as Input } from '../components/opptrix/OpptrixInput'
// 多行文本输入
export { default as Textarea } from '../components/opptrix/OpptrixTextarea'
// 下拉选择器
export { default as Select } from '../components/opptrix/OpptrixSelect'
// 表单字段容器（标签 + 控件 + 说明/错误）
export { default as Field } from '../components/opptrix/OpptrixField'
// 行内即时编辑文本
export { default as InlineEdit } from '../components/opptrix/OpptrixInlineEdit'
// 分段控件（少量互斥选项切换）
export { default as SegmentedControl } from '../components/opptrix/OpptrixSegmentedControl'
// 加载指示器（多尺寸 Spinner）
export { default as Spinner } from '../components/opptrix/OpptrixSpinner'
// 标准表面容器（卡片/面板底板）
export { default as Surface } from '../components/opptrix/OpptrixSurface'
// 标准空态原子：「为什么没有」+「下一步是什么」+ 动作插槽
export { default as EmptyState } from '../components/opptrix/OpptrixEmptyState'
// 确认/警示对话框族（替代 window.confirm/alert — 仓库硬性规则）
export {
  // 确认/警示对话框组件
  OpptrixDialogAlert as DialogAlert,
  // 对话框上下文 Provider（应用根部挂载一次）
  OpptrixDialogAlertProvider as DialogAlertProvider,
  // `const { confirm } = useOpptrixDialogAlert()` Promise 式确认
  useOpptrixDialogAlert as useDialogAlert,
} from '../components/opptrix/OpptrixDialogAlert'
// 自由定位浮层面板（下拉菜单/建议列表容器，自动处理外点关闭）
export { OpptrixDropdownPanel as DropdownPanel } from '../components/opptrix/OpptrixDropdownPanel'

// ─── 标准件：SettingsPrimitives 设置域标准分子件（面板布局词汇表全集） ───
export {
  // 设置分组容器（带发丝边框与表面色）
  SettingsGroup,
  // 设置卡片容器
  SettingsCard,
  // 设置分节头（kicker + 标题 + 副标题）
  SettingsSectionHeader,
  // Group 上方页级分节标签
  SettingsSectionLabel,
  // 设置域空态（组合 L1 EmptyState 原子，icon/title/desc 签名）
  SettingsEmptyState,
  // 标准设置行（标签 + 控件）
  SettingsRow,
  // 纯静态内容块（无交互说明区）
  SettingsStaticBlock,
  // 分隔细线（可 fullWidth）
  SettingsDivider,
  // 面板头（标题 + 右侧动作，自带底部分隔线）
  SettingsPanelHeader,
  // 带图标的动作行（点击触发的设置项）
  SettingsActionRow,
  // 外链行（打开外部链接的设置项）
  SettingsExternalLinkRow,
  // 行内即时输入框（点按即改）
  SettingsInlineInput,
  // 标准文本输入行
  SettingsTextField,
  // 密钥/凭据行（掩码显示 + 复制）
  SettingsCredentialRow,
  // 列表面板容器
  SettingsListPanel,
  // 列表滚动区（统一最大高度与滚动条）
  SettingsListScroll,
  // 列表底部「新增」栏
  SettingsAddBar,
  // 标准列表行（主文本 + 元信息 + 行内动作）
  SettingsListRow,
  // 大模型提供商行（提供商 + 模型列表选择）
  SettingsProviderRow,
  // 模式切换页签（设置内局部视图切换）
  SettingsModeTabs,
  // 轻提示（说明性 hint 文案）
  SettingsHint,
  // 条目卡片（摘要 + 状态 + 动作的列表项）
  SettingsItemCard,
  // 状态卡片（服务/能力运行状态展示）
  SettingsStatusCard,
} from '../pages/settings/SettingsPrimitives'
// 设置表面常量（tint / 发丝边框 / 圆角 / 条目色 / 激活投影）— 供扩展面板对齐设置视觉
export {
  settingsSurfaceTint,
  settingsHairlineBorder,
  settingsSurfaceRadius,
  settingsItemTint,
  settingsTabActiveShadow,
} from '../pages/settings/SettingsPrimitives'

// ─── 工具：纯函数（插件复用的最小工具面） ───
// React 列表 key 助手：业务字段 + 强制 index 组合，杜绝重复 key
export { listRowKey } from '../utils/listRowKey'
// 字节数人类可读格式化（B/KB/MB/GB 统一阶梯）
export { formatBytes } from '../utils/formatBytes'

// ─── tokens：主题与设计令牌（扩展主题化契约） ───
export {
  opptrixCssVars,
  FONT_SCALES,
} from '../theme/tokens'
export {
  designTokens,
  SPACING,
  RADIUS,
  Z,
  MOTION,
  CONTROL,
  semantic,
  designTokenCssVars,
} from '../theme/design-tokens'
export type { ThemePreference, ColorScheme, FontScaleName } from '../theme/tokens'

// ─── UX 流：Toast（禁止 window.alert/confirm — 仓库规则） ───
export { useSettingsToast } from '../pages/settings/SettingsToast'
