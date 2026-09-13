import { describe, expect, it } from 'vitest'
import {
  canAccessSettingsSection,
  isAdminSessionRole,
  normalizeSettingsSectionForRole,
} from './roles'

describe('auth roles', () => {
  it('treats missing role as admin for settings navigation', () => {
    expect(isAdminSessionRole(undefined)).toBe(true)
    expect(canAccessSettingsSection('models', undefined)).toBe(true)
  })

  it('limits demo user to account and about settings', () => {
    expect(canAccessSettingsSection('models', 'user')).toBe(false)
    expect(canAccessSettingsSection('account_security', 'user')).toBe(true)
    expect(normalizeSettingsSectionForRole('data_providers', 'user')).toBe('account_security')
  })
})
