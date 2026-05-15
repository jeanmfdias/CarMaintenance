import './setup.js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { makeApp } from './helpers.js'

/**
 * IMPORTANT: TEST_RATE_LIMIT is toggled inside beforeAll/afterAll, NOT at
 * module top-level. Vitest loads all test files for collection before running
 * any of them — a top-level mutation here would leak into every other suite
 * and exhaust the IP-keyed verifyLimiter (used by signInAs) for the whole run.
 */

beforeAll(() => {
  process.env.TEST_RATE_LIMIT = 'on'
})

afterAll(() => {
  delete process.env.TEST_RATE_LIMIT
})

describe('rate limiting', () => {
  it('returns 429 after 5 magic-link requests for the same email in a window', async () => {
    const app = makeApp()

    // Use a unique email so the email-keyed counter starts at zero.
    const email = `rl-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`

    let last = 0
    for (let i = 0; i < 6; i++) {
      const r = await request(app)
        .post('/api/v1/auth/magic-link')
        .send({ email })
      last = r.status
      if (i < 5) {
        expect(r.status).toBe(200)
      }
    }
    expect(last).toBe(429)
  })
})
