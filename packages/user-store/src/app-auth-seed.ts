import type { AppUserRole } from '@opptrix/shared/auth-access'
import {
  AUTH_PASSWORD_MAX,
  AUTH_USERNAME_MAX,
  AUTH_USERNAME_MIN,
  normalizeOwnerUsername,
  validateUsernameInput,
} from '@opptrix/shared/auth-credentials'
import type Database from 'better-sqlite3'
import {
  hashPasswordScrypt,
  randomPasswordSalt,
} from './app-auth-crypto.js'
import {
  ADMIN_USER_ID,
  DEMO_USER_ID,
} from './app-auth-schema.js'

const SEED_PASSWORD_MIN = 6

/** Env-seeded demo accounts only — weaker rules than UI self-registration. */
export function normalizeDemoSeedUsername(raw: string): string {
  const relaxed = raw.trim()
  const strict = validateUsernameInput(relaxed)
  if (strict == null) return normalizeOwnerUsername(relaxed)
  if (relaxed.length < AUTH_USERNAME_MIN || relaxed.length > AUTH_USERNAME_MAX) {
    throw new Error(strict)
  }
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~@-]+$/.test(relaxed)) {
    throw new Error('用户名仅支持英文、数字与常用符号（可用邮箱）')
  }
  return relaxed
}

export function assertDemoSeedPassword(password: string): void {
  if (!password) throw new Error('请填写密码')
  if (password.length > AUTH_PASSWORD_MAX) throw new Error('密码过长，请缩短后再试')
  if (password.length < SEED_PASSWORD_MIN) {
    throw new Error(`预置账户密码至少 ${SEED_PASSWORD_MIN} 位`)
  }
}

export interface DemoAccountSeedInput {
  adminUsername: string
  adminPassword: string
  userUsername: string
  userPassword: string
}

export interface DemoAccountSeedEnv {
  adminUsername: string
  adminPassword: string
  userUsername: string
  userPassword: string
}

function readEnv(name: string): string {
  return String(process.env[name] ?? '').trim()
}

export function readDemoAccountSeedEnv(): DemoAccountSeedEnv | null {
  const adminPassword = readEnv('OPPTRIX_ADMIN_PASSWORD')
  const userPassword = readEnv('OPPTRIX_USER_PASSWORD')
  if (!adminPassword || !userPassword) return null
  return {
    adminUsername: readEnv('OPPTRIX_ADMIN_USERNAME') || 'admin',
    adminPassword,
    userUsername: readEnv('OPPTRIX_USER_USERNAME') || 'user1',
    userPassword,
  }
}

export function isAuthSetupDisabledByEnv(): boolean {
  return readEnv('OPPTRIX_AUTH_SETUP_DISABLED') === '1' || readDemoAccountSeedEnv() != null
}

function insertUser(
  db: Database.Database,
  input: {
    id: string
    username: string
    password: string
    role: AppUserRole
    createdAt: string
  },
): void {
  const username = normalizeDemoSeedUsername(input.username)
  assertDemoSeedPassword(input.password)
  const salt = randomPasswordSalt()
  const hash = hashPasswordScrypt(input.password, salt)
  db.prepare(`
    INSERT INTO app_users(
      id, username, role, password_salt, password_hash,
      totp_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(input.id, username, input.role, salt, hash, input.createdAt, input.createdAt)
}

export function seedDemoAccountsIfEmpty(
  db: Database.Database,
  input: DemoAccountSeedInput,
): boolean {
  const count = db.prepare('SELECT COUNT(*) AS n FROM app_users').get() as { n: number }
  if (count.n > 0) return false
  const createdAt = new Date().toISOString()
  insertUser(db, {
    id: ADMIN_USER_ID,
    username: input.adminUsername,
    password: input.adminPassword,
    role: 'admin',
    createdAt,
  })
  insertUser(db, {
    id: DEMO_USER_ID,
    username: input.userUsername,
    password: input.userPassword,
    role: 'user',
    createdAt,
  })
  return true
}

export function maybeSeedDemoAccountsFromEnv(db: Database.Database): boolean {
  const env = readDemoAccountSeedEnv()
  if (!env) return false
  return seedDemoAccountsIfEmpty(db, env)
}
