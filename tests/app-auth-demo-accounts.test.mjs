/**
 * Demo admin/user accounts — env seed + role login.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let dataDir = ''

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'opptrix-demo-auth-'))
  process.env.OPPTRIX_DATA_DIR = dataDir
  process.env.OPPTRIX_AUTH_KEY_PATH = join(dataDir, 'auth.key')
  process.env.OPPTRIX_ADMIN_USERNAME = 'admin'
  process.env.OPPTRIX_ADMIN_PASSWORD = '123456'
  process.env.OPPTRIX_USER_USERNAME = 'user1'
  process.env.OPPTRIX_USER_PASSWORD = '123456'
})

after(async () => {
  delete process.env.OPPTRIX_ADMIN_USERNAME
  delete process.env.OPPTRIX_ADMIN_PASSWORD
  delete process.env.OPPTRIX_USER_USERNAME
  delete process.env.OPPTRIX_USER_PASSWORD
  try {
    const { getUserDataStore, resetAuthKeyCacheForTests } = await import('../packages/user-store/dist/index.js')
    getUserDataStore().close()
    resetAuthKeyCacheForTests()
  } catch {
    /* store may not have been opened */
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true })
})

describe('demo account seed', () => {
  it('seeds admin and user on first boot when env passwords are set', async () => {
    const { getUserDataStore } = await import('../packages/user-store/dist/index.js')
    const auth = getUserDataStore().appAuth
    assert.equal(auth.isClaimed(), true)
    assert.equal(auth.isSetupDisabled(), true)
    const admin = auth.verifyLogin('admin', '123456')
    const user = auth.verifyLogin('user1', '123456')
    assert.equal(admin?.role, 'admin')
    assert.equal(user?.role, 'user')
    assert.throws(() => auth.createOwner({ username: 'other', password: 'Other1!pass' }))
  })
})
