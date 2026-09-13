/**
 * Local auth repository — app_users (admin/user) + hashed sessions.
 */
import type Database from 'better-sqlite3'
import type { AppUserRole } from '@opptrix/shared/auth-access'
import {
  assertOwnerPassword,
  normalizeOwnerUsername,
} from '@opptrix/shared'
import {
  decryptAuthSecret,
  encryptAuthSecret,
  generateRecoveryCodes,
  hashPasswordScrypt,
  parseRecoveryHashesJson,
  randomPasswordSalt,
  verifyPasswordScrypt,
  verifyRecoveryCode,
} from './app-auth-crypto.js'
import {
  ADMIN_USER_ID,
  initAppAuthSchema,
  OWNER_ROW_ID,
} from './app-auth-schema.js'
import {
  buildOtpauthUrl,
  generateTotpSecretBase32,
  verifyTotpCode,
} from './app-auth-totp.js'
import {
  getAuthSessionByTokenHash,
  insertAuthSession,
  issueAuthSession,
  listAuthSessions,
  revokeAllAuthSessions,
  revokeAuthSession,
  touchAuthSession,
  wipeAuthTables,
  type AuthSessionPublic,
  type AuthSessionRow,
  type CreateSessionInput,
} from './app-auth-sessions.js'
import { isAuthSetupDisabledByEnv } from './app-auth-seed.js'

export {
  APP_AUTH_SCHEMA_MIGRATION_KEY,
  APP_AUTH_V2_MIGRATION_KEY,
  APP_AUTH_ENV_SEED_MIGRATION_KEY,
  AUTH_SESSION_TTL_DESKTOP_MS,
  AUTH_SESSION_TTL_WEB_MS,
  initAppAuthSchema,
  OWNER_ROW_ID,
  ADMIN_USER_ID,
  DEMO_USER_ID,
} from './app-auth-schema.js'
export {
  generateSessionToken,
  hashSessionToken,
  hashPasswordScrypt,
  verifyPasswordScrypt,
  randomPasswordSalt,
  isAuthSafeModeEnv,
  resetAuthKeyCacheForTests,
  generateRecoveryCodes,
  verifyRecoveryCode,
} from './app-auth-crypto.js'
export {
  generateTotpSecretBase32,
  totpCodeAt,
  verifyTotpCode,
  buildOtpauthUrl,
  encodeBase32,
  decodeBase32,
  hotp,
} from './app-auth-totp.js'
export {
  readDemoAccountSeedEnv,
  maybeSeedDemoAccountsFromEnv,
  isAuthSetupDisabledByEnv,
  seedDemoAccountsIfEmpty,
} from './app-auth-seed.js'
export { migrateAppAuthV2 } from './app-auth-v2-migrate.js'
export type { AuthSessionPublic, AuthSessionRow, CreateSessionInput } from './app-auth-sessions.js'

export interface OwnerPublic {
  username: string
  totp_enabled: boolean
  created_at: string
}

export interface AppUserPublic {
  id: string
  username: string
  role: AppUserRole
  totp_enabled: boolean
  created_at: string
}

export interface VerifiedLoginUser {
  id: string
  username: string
  role: AppUserRole
  totp_enabled: boolean
}

interface UserRow {
  id: string
  username: string
  role: AppUserRole
  password_salt: Buffer
  password_hash: Buffer
  totp_secret_enc: Buffer | null
  totp_secret_iv: Buffer | null
  totp_secret_tag: Buffer | null
  totp_enabled: number
  recovery_codes_json: string | null
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function asUserPublic(row: UserRow): AppUserPublic {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    totp_enabled: row.totp_enabled === 1,
    created_at: row.created_at,
  }
}

export class AppAuthRepository {
  private pendingTotpSecret: string | null = null

  constructor(private readonly db: Database.Database) {
    initAppAuthSchema(this.db)
  }

  private readUserById(id: string): UserRow | null {
    const row = this.db.prepare('SELECT * FROM app_users WHERE id = ?').get(id.trim()) as
      | UserRow
      | undefined
    return row ?? null
  }

  private readUserByUsername(username: string): UserRow | null {
    const row = this.db.prepare(`
      SELECT * FROM app_users WHERE username = ? COLLATE NOCASE
    `).get(username.trim()) as UserRow | undefined
    return row ?? null
  }

  private readAdminUser(): UserRow | null {
    const byId = this.readUserById(ADMIN_USER_ID)
    if (byId) return byId
    const row = this.db.prepare(`
      SELECT * FROM app_users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
    `).get() as UserRow | undefined
    return row ?? null
  }

  private readLegacyOwner(): {
    username: string
    password_salt: Buffer
    password_hash: Buffer
    created_at: string
  } | null {
    const row = this.db.prepare('SELECT * FROM app_owner WHERE id = ?').get(OWNER_ROW_ID) as
      | {
        username: string
        password_salt: Buffer
        password_hash: Buffer
        created_at: string
      }
      | undefined
    return row ?? null
  }

  isClaimed(): boolean {
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM app_users').get() as { n: number }
    if (count.n > 0) return true
    return this.readLegacyOwner() != null
  }

  isSetupDisabled(): boolean {
    return isAuthSetupDisabledByEnv()
  }

  getOwnerPublic(): OwnerPublic | null {
    const admin = this.readAdminUser()
    if (admin) {
      return {
        username: admin.username,
        totp_enabled: admin.totp_enabled === 1,
        created_at: admin.created_at,
      }
    }
    const legacy = this.readLegacyOwner()
    if (!legacy) return null
    return {
      username: legacy.username,
      totp_enabled: false,
      created_at: legacy.created_at,
    }
  }

  getUserPublic(userId: string): AppUserPublic | null {
    const row = this.readUserById(userId)
    return row ? asUserPublic(row) : null
  }

  createOwner(input: { username: string; password: string }): void {
    if (this.isSetupDisabled()) throw new Error('当前部署已关闭自助注册')
    if (this.isClaimed()) throw new Error('账户已创建')
    const username = normalizeOwnerUsername(input.username)
    assertOwnerPassword(input.password)
    const salt = randomPasswordSalt()
    const hash = hashPasswordScrypt(input.password, salt)
    const ts = nowIso()
    this.db.prepare(`
      INSERT INTO app_users(
        id, username, role, password_salt, password_hash, totp_enabled, created_at, updated_at
      ) VALUES (?, ?, 'admin', ?, ?, 0, ?, ?)
    `).run(ADMIN_USER_ID, username, salt, hash, ts, ts)
  }

  verifyLogin(username: string, password: string): VerifiedLoginUser | null {
    const row = this.readUserByUsername(username)
    if (row) {
      const ok = verifyPasswordScrypt(password, row.password_salt, row.password_hash)
      if (!ok) return null
      return {
        id: row.id,
        username: row.username,
        role: row.role,
        totp_enabled: row.totp_enabled === 1,
      }
    }
    const legacy = this.readLegacyOwner()
    if (!legacy || username.trim() !== legacy.username) {
      if (legacy) verifyPasswordScrypt(password, legacy.password_salt, legacy.password_hash)
      return null
    }
    if (!verifyPasswordScrypt(password, legacy.password_salt, legacy.password_hash)) return null
    return {
      id: ADMIN_USER_ID,
      username: legacy.username,
      role: 'admin',
      totp_enabled: false,
    }
  }

  verifyUsernamePassword(username: string, password: string): boolean {
    return this.verifyLogin(username, password) != null
  }

  verifyPassword(password: string): boolean {
    const admin = this.readAdminUser()
    if (admin) {
      return verifyPasswordScrypt(password, admin.password_salt, admin.password_hash)
    }
    const legacy = this.readLegacyOwner()
    if (!legacy) return false
    return verifyPasswordScrypt(password, legacy.password_salt, legacy.password_hash)
  }

  verifyUserPassword(userId: string, password: string): boolean {
    const row = this.readUserById(userId)
    if (!row) return false
    return verifyPasswordScrypt(password, row.password_salt, row.password_hash)
  }

  setPassword(newPassword: string): void {
    this.setUserPassword(ADMIN_USER_ID, newPassword)
  }

  setUserPassword(userId: string, newPassword: string): void {
    const row = this.readUserById(userId)
    if (!row) throw new Error('尚未创建账户')
    assertOwnerPassword(newPassword)
    const salt = randomPasswordSalt()
    const hash = hashPasswordScrypt(newPassword, salt)
    this.db.prepare(`
      UPDATE app_users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?
    `).run(salt, hash, nowIso(), row.id)
  }

  setTotpPendingSecret(secretPlain: string): void {
    if (!this.isClaimed()) throw new Error('尚未创建账户')
    this.pendingTotpSecret = secretPlain.trim()
  }

  beginTotpSetup(): { otpauth_url: string; secret: string } {
    const admin = this.readAdminUser()
    if (!admin) throw new Error('尚未创建账户')
    const secret = generateTotpSecretBase32()
    this.pendingTotpSecret = secret
    return { secret, otpauth_url: buildOtpauthUrl(admin.username, secret) }
  }

  confirmTotp(code: string): { recovery_codes: string[] } {
    const pending = this.pendingTotpSecret
    if (!pending) throw new Error('请先开始两步验证设置')
    if (!verifyTotpCode(pending, code)) throw new Error('验证码不正确')
    const admin = this.readAdminUser()
    if (!admin) throw new Error('尚未创建账户')
    const { ciphertext, iv, tag } = encryptAuthSecret(pending)
    const { plain, hashes } = generateRecoveryCodes()
    this.db.prepare(`
      UPDATE app_users SET
        totp_secret_enc = ?, totp_secret_iv = ?, totp_secret_tag = ?,
        totp_enabled = 1, recovery_codes_json = ?, updated_at = ?
      WHERE id = ?
    `).run(ciphertext, iv, tag, JSON.stringify(hashes), nowIso(), admin.id)
    this.pendingTotpSecret = null
    return { recovery_codes: plain }
  }

  disableTotp(password: string, code?: string): void {
    const admin = this.readAdminUser()
    if (!admin) throw new Error('尚未创建账户')
    if (!verifyPasswordScrypt(password, admin.password_salt, admin.password_hash)) {
      throw new Error('密码不正确')
    }
    if (admin.totp_enabled === 1) {
      const totpOk = code ? this.verifyTotp(code) : false
      const recoveryOk = code
        ? verifyRecoveryCode(code, parseRecoveryHashesJson(admin.recovery_codes_json))
        : false
      if (!totpOk && !recoveryOk) throw new Error('验证码不正确')
    }
    this.clearTotpFields(admin.id)
  }

  forceClearTotp(): void {
    const admin = this.readAdminUser()
    if (!admin) return
    this.clearTotpFields(admin.id)
  }

  adminResetPassword(opts: { newPassword: string; disableTotp?: boolean }): {
    username: string
    totpWasEnabled: boolean
    totpDisabled: boolean
    sessionsRevoked: number
  } {
    const admin = this.readAdminUser()
    if (!admin) throw new Error('尚未创建账户')
    const totpWasEnabled = admin.totp_enabled === 1
    const shouldDisableTotp = opts.disableTotp !== false
    this.setUserPassword(admin.id, opts.newPassword)
    let totpDisabled = false
    if (shouldDisableTotp) {
      this.clearTotpFields(admin.id)
      totpDisabled = totpWasEnabled
    }
    const sessionsRevoked = this.revokeAllSessions()
    return {
      username: admin.username,
      totpWasEnabled,
      totpDisabled,
      sessionsRevoked,
    }
  }

  private clearTotpFields(userId: string): void {
    this.db.prepare(`
      UPDATE app_users SET
        totp_secret_enc = NULL, totp_secret_iv = NULL, totp_secret_tag = NULL,
        totp_enabled = 0, recovery_codes_json = NULL, updated_at = ?
      WHERE id = ?
    `).run(nowIso(), userId)
    this.pendingTotpSecret = null
  }

  verifyTotp(code: string): boolean {
    const admin = this.readAdminUser()
    if (!admin || admin.totp_enabled !== 1) return false
    if (!admin.totp_secret_enc || !admin.totp_secret_iv || !admin.totp_secret_tag) return false
    try {
      const secret = decryptAuthSecret({
        ciphertext: admin.totp_secret_enc,
        iv: admin.totp_secret_iv,
        tag: admin.totp_secret_tag,
      })
      return verifyTotpCode(secret, code)
    } catch {
      return false
    }
  }

  createSession(input: CreateSessionInput): { id: string; expires_at: string } {
    return insertAuthSession(this.db, input)
  }

  issueSession(input: Omit<CreateSessionInput, 'tokenPlain'>): {
    id: string
    token: string
    expires_at: string
  } {
    return issueAuthSession(this.db, input)
  }

  touchSession(id: string): void {
    touchAuthSession(this.db, id)
  }

  getSessionByTokenHash(hash: string): AuthSessionRow | null {
    return getAuthSessionByTokenHash(this.db, hash)
  }

  listSessions(): AuthSessionPublic[] {
    return listAuthSessions(this.db)
  }

  revokeSession(id: string): boolean {
    return revokeAuthSession(this.db, id)
  }

  revokeAllSessions(exceptId?: string): number {
    return revokeAllAuthSessions(this.db, exceptId)
  }

  wipeOwnerForSafeMode(): void {
    wipeAuthTables(this.db)
    this.pendingTotpSecret = null
  }
}
