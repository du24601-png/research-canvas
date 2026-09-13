import type { SettingsSection } from './settingsTypes'
import { isElectron } from '../../platform/detect'

export interface SettingsSearchEntry {
  section: SettingsSection
  group?: string
  title: string
  desc?: string
  keywords?: string[]
  desktopOnly?: boolean
  webOnly?: boolean
}

function fold(text: string): string {
  return text.toLowerCase().trim()
}

function haystack(entry: SettingsSearchEntry): string {
  return fold([
    entry.group,
    entry.title,
    entry.desc,
    ...(entry.keywords ?? []),
  ].filter(Boolean).join(' '))
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  { section: 'general', title: '常规', desc: '管理默认评分卡与后端连接状态' },
  { section: 'account_security', title: '账户与安全', desc: '本地登录、密码与可选两步验证', keywords: ['账户', '安全', '登录', '密码', '两步验证', '身份验证器', '恢复码', '会话', '设备'] },
  { section: 'models', title: '大模型', desc: '配置大模型提供商与可用模型', keywords: ['模型', 'LLM', 'AI'] },
  { section: 'data_providers', title: '数据源', desc: '管理行情与财务数据提供商', keywords: ['Tushare', 'priority', '回退', '拖拽', '排序'] },
  { section: 'translation', title: '翻译', desc: '配置离线翻译与远程大模型回退' },
  { section: 'multimodal', title: '多模态', desc: '配置图片 OCR、语音转写与媒体处理策略' },
  { section: 'mcp_servers', title: 'MCP 服务', desc: '外部 MCP 接入与优先级故障转移', keywords: ['mcp', 'stdio', 'http', '外部工具', 'MCP 服务器'] },
  { section: 'sandbox', title: '工作区隔离', desc: '查看命令保护与网络访问规则', keywords: ['沙盒', '沙盒环境', '命令隔离', '工作区隔离'] },
  { section: 'python', title: 'Python', desc: '查看 Python 状态、配置镜像源与安装选项' },
  { section: 'about', title: '关于', desc: '产品说明与版本信息' },
]

const SECTION_LABEL: Record<SettingsSection, string> = {
  general: '常规',
  account_security: '账户与安全',
  models: '大模型',
  data_providers: '数据源',
  translation: '翻译',
  multimodal: '多模态',
  mcp_servers: 'MCP 服务',
  sandbox: '工作区隔离',
  python: 'Python',
  about: '关于',
}

export function settingsSectionLabel(section: SettingsSection): string {
  return SECTION_LABEL[section]
}

export function searchSettingsEntries(
  query: string,
  dynamic: SettingsSearchEntry[] = [],
): SettingsSearchEntry[] {
  const q = fold(query)
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const hits: SettingsSearchEntry[] = []

  for (const entry of [...SETTINGS_SEARCH_INDEX, ...dynamic]) {
    if (entry.desktopOnly && !isElectron()) continue
    if (entry.webOnly && isElectron()) continue
    const hay = haystack(entry)
    if (!tokens.every(token => hay.includes(token))) continue
    const key = `${entry.section}\0${entry.group ?? ''}\0${entry.title}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push(entry)
  }

  return hits
}

export function matchingSettingsSections(
  query: string,
  dynamic: SettingsSearchEntry[] = [],
): SettingsSection[] {
  const sections = new Set<SettingsSection>()
  for (const hit of searchSettingsEntries(query, dynamic)) {
    sections.add(hit.section)
  }
  return [...sections]
}
