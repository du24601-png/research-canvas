export type SettingsSection =
  | 'general'
  | 'account_security'
  | 'models'
  | 'data_providers'
  | 'mcp_servers'
  | 'sandbox'
  | 'python'
  | 'translation'
  | 'multimodal'
  | 'about'

const SETTINGS_SECTION_IDS: readonly SettingsSection[] = [
  'general',
  'account_security',
  'models',
  'data_providers',
  'translation',
  'multimodal',
  'mcp_servers',
  'sandbox',
  'python',
  'about',
]

export function isSettingsSection(value: unknown): value is SettingsSection {
  return typeof value === 'string'
    && (SETTINGS_SECTION_IDS as readonly string[]).includes(value)
}

/** Coerce navigation targets; invalid or missing values fall back to 常规. */
export function normalizeSettingsSection(section?: unknown): SettingsSection {
  if (!isSettingsSection(section)) return 'general'
  return section
}
