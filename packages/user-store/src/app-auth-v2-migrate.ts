import type Database from 'better-sqlite3'
import {
  ADMIN_USER_ID,
  ensureAuthSessionsUserIdColumn,
  initAppAuthSchema,
  OWNER_ROW_ID,
} from './app-auth-schema.js'

export function migrateAppAuthV2(db: Database.Database): void {
  initAppAuthSchema(db)
  ensureAuthSessionsUserIdColumn(db)

  const userCount = db.prepare('SELECT COUNT(*) AS n FROM app_users').get() as { n: number }
  if (userCount.n === 0) {
    const owner = db.prepare('SELECT * FROM app_owner WHERE id = ?').get(OWNER_ROW_ID) as
      | Record<string, unknown>
      | undefined
    if (owner) {
      db.prepare(`
        INSERT INTO app_users(
          id, username, role, password_salt, password_hash,
          totp_secret_enc, totp_secret_iv, totp_secret_tag,
          totp_enabled, recovery_codes_json, created_at, updated_at
        ) VALUES (
          @id, @username, 'admin', @password_salt, @password_hash,
          @totp_secret_enc, @totp_secret_iv, @totp_secret_tag,
          @totp_enabled, @recovery_codes_json, @created_at, @updated_at
        )
      `).run({
        id: ADMIN_USER_ID,
        username: owner.username,
        password_salt: owner.password_salt,
        password_hash: owner.password_hash,
        totp_secret_enc: owner.totp_secret_enc,
        totp_secret_iv: owner.totp_secret_iv,
        totp_secret_tag: owner.totp_secret_tag,
        totp_enabled: owner.totp_enabled,
        recovery_codes_json: owner.recovery_codes_json,
        created_at: owner.created_at,
        updated_at: owner.updated_at,
      })
    }
  }

  db.prepare(`
    UPDATE auth_sessions
    SET user_id = ?
    WHERE user_id IS NULL OR TRIM(user_id) = ''
  `).run(ADMIN_USER_ID)
}
