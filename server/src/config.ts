import 'dotenv/config'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

const ROOT = path.resolve(process.cwd())

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProd = nodeEnv === 'production'

const INSECURE_JWT_SECRETS = new Set(['change-me-in-production', 'dev-insecure-secret-change-me'])
const jwtSecret = requireEnv('JWT_SECRET', 'dev-insecure-secret-change-me')

if (isProd && (INSECURE_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET must be set to a strong unique value (>=32 chars) when NODE_ENV=production. ' +
      'Refusing to boot.'
  )
}

// Load version from package.json (best-effort)
let version = '0.0.0'
try {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // From dist/, package.json is at ../package.json; from src/, also ../package.json
  const pkgPath = path.resolve(here, '..', 'package.json')
  const raw = readFileSync(pkgPath, 'utf8')
  const pkg = JSON.parse(raw) as { version?: string }
  if (pkg.version) version = pkg.version
} catch {
  // ignore — keeps default
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  version,
  databasePath:
    process.env.DATABASE_PATH && (path.isAbsolute(process.env.DATABASE_PATH) || process.env.DATABASE_PATH === ':memory:')
      ? process.env.DATABASE_PATH
      : path.join(ROOT, process.env.DATABASE_PATH ?? './data/app.db'),
  uploadsDir:
    process.env.UPLOADS_DIR && path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.join(ROOT, process.env.UPLOADS_DIR ?? './data/uploads'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  magicLinkTtlMin: Number(process.env.MAGIC_LINK_TTL_MIN ?? 15),
  publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: (() => {
    const v = process.env.TRUST_PROXY
    if (!v) return false
    if (v === 'true') return true
    if (v === 'false') return false
    const n = Number(v)
    return Number.isFinite(n) ? n : v
  })() as boolean | number | string,
  bodyLimit: process.env.BODY_LIMIT ?? '100kb',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'CarMaintenance <no-reply@example.com>',
  },
}

export type Config = typeof config
