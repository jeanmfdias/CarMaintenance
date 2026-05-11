import 'dotenv/config'
import path from 'node:path'

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value
}

const ROOT = path.resolve(process.cwd())

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  databasePath:
    process.env.DATABASE_PATH && path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.join(ROOT, process.env.DATABASE_PATH ?? './data/app.db'),
  uploadsDir:
    process.env.UPLOADS_DIR && path.isAbsolute(process.env.UPLOADS_DIR)
      ? process.env.UPLOADS_DIR
      : path.join(ROOT, process.env.UPLOADS_DIR ?? './data/uploads'),
  jwtSecret: requireEnv('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  magicLinkTtlMin: Number(process.env.MAGIC_LINK_TTL_MIN ?? 15),
  publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'CarMaintenance <no-reply@example.com>',
  },
}

export type Config = typeof config
