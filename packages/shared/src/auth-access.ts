/** Demo / self-host account roles and admin-only API surface. */

export type AppUserRole = 'admin' | 'user'

export const APP_USER_ROLES: readonly AppUserRole[] = ['admin', 'user']

export function isAppUserRole(value: unknown): value is AppUserRole {
  return value === 'admin' || value === 'user'
}

function isPlatformMutate(method: string, path: string): boolean {
  if (path !== '/api/platform' && !path.startsWith('/api/platform/')) return false
  const m = method.toUpperCase()
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE'
}

/** Routes that require an admin session once the instance is claimed. */
export function requiresAdminRole(method: string, path: string): boolean {
  const m = method.toUpperCase()
  if (isPlatformMutate(method, path)) return true
  if (path.startsWith('/api/ext/')) return true
  if (path.startsWith('/api/auth/totp/')) return true
  if (m === 'PATCH' && path === '/api/config') return true
  if (m === 'POST' && path === '/api/providers') return true
  if (m === 'POST' && path === '/api/providers/discover-models') return true
  if ((m === 'PATCH' || m === 'PUT') && /^\/api\/providers\/[^/]+$/.test(path)) return true
  if (m === 'DELETE' && /^\/api\/providers\/[^/]+$/.test(path)) return true
  if (m === 'PUT' && path === '/api/settings/sandbox') return true
  if (m === 'PUT' && path.startsWith('/api/settings/')) return true
  if (m === 'PUT' && path === '/api/news/settings') return true
  if (m === 'POST' && path.startsWith('/api/tushare/')) return true
  if (m === 'POST' && path.startsWith('/api/data/providers')) return true
  if (m === 'POST' && path.startsWith('/api/system-update')) return true
  if (m === 'POST' && path.startsWith('/api/system/core-models')) return true
  if ((m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE')
    && path.startsWith('/api/mcp-servers')) return true
  if (path.startsWith('/api/platform/extensions/')
    && path.endsWith('/storage/export')) return true
  return false
}
