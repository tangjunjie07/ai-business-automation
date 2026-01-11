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

export const config = {
  runtime,
  database,
  storage,
  auth,
  sentry,
  featureFlags,
}

export type Config = typeof config

export default config
