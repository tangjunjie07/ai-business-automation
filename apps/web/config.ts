export const ROUTES = {
  SIGNIN: '/auth/signin',
  SUPER_ADMIN_SIGNIN: '/auth/super-admin-signin',
  DASHBOARD: '/dashboard',
  CHAT: '/chat',
  SUPER_ADMIN_DASHBOARD: '/super-admin/dashboard',
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const

export function isNormalUser(role?: string) {
  return !!role && role !== ROLES.SUPER_ADMIN && role !== ROLES.ADMIN
}

export default {
  ROUTES,
  ROLES,
  isNormalUser,
}
