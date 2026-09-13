import type { AppUserRole } from '@opptrix/shared/auth-access'
import type { SettingsSection } from '../pages/settings/settingsTypes'

const USER_SETTINGS_SECTIONS = new Set<SettingsSection>(['account_security', 'about'])

export function isAdminSessionRole(role: AppUserRole | undefined): boolean {
  return role == null || role === 'admin'
}

export function canAccessSettingsSection(
  section: SettingsSection,
  role: AppUserRole | undefined,
): boolean {
  if (isAdminSessionRole(role)) return true
  return USER_SETTINGS_SECTIONS.has(section)
}

export function normalizeSettingsSectionForRole(
  section: SettingsSection | undefined,
  role: AppUserRole | undefined,
): SettingsSection {
  const next = section ?? 'general'
  if (canAccessSettingsSection(next, role)) return next
  return 'account_security'
}
