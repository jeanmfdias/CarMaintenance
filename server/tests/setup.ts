import { beforeEach } from 'vitest'
import { _resetDbForTests } from '../src/db/index.js'
import { runMigrations } from '../src/db/migrate.js'

// Set required env before anything else loads config
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret'
process.env.PUBLIC_APP_URL = 'http://localhost:5173'
process.env.CORS_ORIGIN = 'http://localhost:5173'
process.env.DATABASE_PATH = ':memory:'

beforeEach(() => {
  _resetDbForTests()
  runMigrations()
})
