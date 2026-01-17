type RuntimeEnv = 'development' | 'staging' | 'production' | 'canary'

const get = (k: string, d?: string) => process.env[k] ?? d

export const runtime = {
  env: (get('NODE_ENV', 'development') as RuntimeEnv),
  releaseProfile: get('RELEASE_PROFILE', get('NODE_ENV', 'development')) as string,
}

export const database = {
  url: get('DATABASE_URL', ''),
  migrationsEnabled: get('MIGRATIONS_ENABLED', 'true') === 'true',
}

export const storage = {
  provider: (get('STORAGE_PROVIDER', 'local') as 'local' | 's3' | 'azure'),
  bucket: get('AWS_S3_BUCKET', ''),
  region: get('AWS_REGION', ''),
  accessKeyId: get('AWS_ACCESS_KEY_ID', ''),
  secretAccessKey: get('AWS_SECRET_ACCESS_KEY', ''),
}

export const auth = {
  nextAuthUrl: get('NEXTAUTH_URL', ''),
  secret: get('NEXTAUTH_SECRET', ''),
  cookieSecure: runtime.env === 'production',
}

export const sentry = {
  dsn: get('SENTRY_DSN', ''),
  environment: get('SENTRY_ENVIRONMENT', runtime.env),
  tracesSampleRate: Number(get('SENTRY_TRACES_SAMPLE_RATE', '0')),
}

export const featureFlags = {
  enableNewOCR: get('FEATURE_ENABLE_NEW_OCR', 'false') === 'true',
}

// NOTE: NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_WS_BASE_URL are no longer used.
// Keep the `network` object for compatibility; callers should fallback to
// same-origin or explicit runtime values instead of relying on these envs.
export const network = {
  apiBase: '',
  wsBase: '',
}

export const dify = {
  apiBase: get('DIFY_API_BASE', 'https://api.dify.ai'),
}

// Server-only accessor for secret key. DO NOT call from client-side code.
export function getDifyKey(): string {
  if (typeof window !== 'undefined') throw new Error('getDifyKey must be used server-side')
  return (get('DIFY_API_KEY', '') as string)
}

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

export const config = {
  runtime,
  database,
  storage,
  auth,
  sentry,
  featureFlags,
  network,
  ROUTES,
  ROLES,
  isNormalUser,
}

export type Config = typeof config

export default config
