// CRITICAL: set test env vars BEFORE any other module loads.
// In particular before `../src/config.js` which calls `dotenv/config` and
// would otherwise pull in the developer's local .env (and try to send real
// emails via SMTP, etc.). Once config has snapshotted process.env, later
// assignments here are too late.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.PUBLIC_APP_URL = 'http://localhost:5173'
process.env.CORS_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'
process.env.SMTP_HOST = ''
// Belt-and-braces: tell dotenv not to override even if our defaults got
// missed somehow. (dotenv default is `override: false`, but be explicit.)
process.env.DOTENV_CONFIG_OVERRIDE = 'false'

import { beforeEach } from 'vitest'
import { _resetDbForTests } from '../src/db/index.js'
import { runMigrations } from '../src/db/migrate.js'
import { _resetRateLimitForTests } from '../src/middleware/rateLimit.js'

beforeEach(() => {
  _resetDbForTests()
  runMigrations()
  _resetRateLimitForTests()
  // Re-assert any env we care about in case some prior test mutated it.
  process.env.SMTP_HOST = ''
})
