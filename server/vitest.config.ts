import { defineConfig } from 'vitest/config'

// CRITICAL: these env vars MUST be set before any test or source module
// loads — in particular before src/config.ts runs `dotenv/config`, which
// would otherwise import the developer's local .env (real SMTP host, etc.)
// and break tests that depend on the "no SMTP configured" code path.
// Vitest applies `test.env` before importing any test file.
process.env.NODE_ENV = 'test'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Run tests serially in a single process so the in-memory SQLite and
        // module-level singletons (rate-limit stores, config) are consistent
        // across files.
        singleFork: true,
      },
    },
    // Prevent supertest connection reuse from interleaving responses between
    // back-to-back tests (causes occasional "Parse Error: Expected HTTP/" on
    // Node 22). Forces a sequential test order within each file.
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      PUBLIC_APP_URL: 'http://localhost:5173',
      CORS_ORIGIN: 'http://localhost:5173',
      DATABASE_PATH: ':memory:',
      SMTP_HOST: '',
      SMTP_PORT: '587',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: 'CarMaintenance <no-reply@example.com>',
      // Disable rate limit by default in tests; rateLimit.test toggles to 'on'.
      TEST_RATE_LIMIT: '',
    },
  },
})
