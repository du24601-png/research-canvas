import test from 'node:test'
import assert from 'node:assert/strict'
import { requiresAdminRole } from '../packages/shared/dist/auth-access.js'

test('requiresAdminRole blocks user mutations on admin-only routes', () => {
  assert.equal(requiresAdminRole('PATCH', '/api/config'), true)
  assert.equal(requiresAdminRole('POST', '/api/providers'), true)
  assert.equal(requiresAdminRole('PUT', '/api/settings/sandbox'), true)
  assert.equal(requiresAdminRole('POST', '/api/system-update/apply'), true)
  assert.equal(requiresAdminRole('POST', '/api/sessions'), false)
  assert.equal(requiresAdminRole('POST', '/api/research/snapshots'), false)
  assert.equal(requiresAdminRole('GET', '/api/config'), false)
})
