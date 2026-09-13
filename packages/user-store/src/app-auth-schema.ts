import type Database from 'better-sqlite3'

export const APP_AUTH_SCHEMA_MIGRATION_KEY = 'app_auth_v1'
export const APP_AUTH_V2_MIGRATION_KEY = 'app_auth_v2'
export const APP_AUTH_ENV_SEED_MIGRATION_KEY = 'app_auth_env_seed_v1'
export const OWNER_ROW_ID = 'owner'
export const ADMIN_USER_ID = 'admin'
export const DEMO_USER_ID = 'user'

export const AUTH_SESSION_TTL_DESKTOP_MS = 30 * 24 * 60 * 60 * 1000
export const AUTH_SESSION_TTL_WEB_MS = 12 * 60 * 60 * 1000

export function initAppAuthSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_owner (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_salt BLOB NOT NULL,
      password_hash BLOB NOT NULL,
      totp_secret_enc BLOB,
      totp_secret_iv BLOB,
      totp_secret_tag BLOB,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id TEXT,
      label TEXT,
      client_ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      desktop INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      password_salt BLOB NOT NULL,
      password_hash BLOB NOT NULL,
      totp_secret_enc BLOB,
      totp_secret_iv BLOB,
      totp_secret_tag BLOB,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      recovery_codes_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_username
      ON app_users(username COLLATE NOCASE);
  `)
}

export function ensureAuthSessionsUserIdColumn(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(auth_sessions)').all() as Array<{ name: string }>
  if (cols.some(col => col.name === 'user_id')) return
  db.exec('ALTER TABLE auth_sessions ADD COLUMN user_id TEXT')
}
