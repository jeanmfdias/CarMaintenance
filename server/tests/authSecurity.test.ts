import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('auth security', () => {
  it('rejects a malformed bearer (header present, token missing)', async () => {
    const app = makeApp()
    const r = await request(app).get('/api/v1/vehicles').set('Authorization', 'Bearer ')
    expect(r.status).toBe(401)
    expect(r.body.error.code).toBe('unauthorized')
  })

  it('rejects a non-Bearer Authorization scheme', async () => {
    const app = makeApp()
    const r = await request(app).get('/api/v1/vehicles').set('Authorization', 'Basic Zm9vOmJhcg==')
    expect(r.status).toBe(401)
  })

  it('rejects access after the session row is revoked', async () => {
    const app = makeApp()
    const { token, userId } = await signInAs(app, 'rev@example.com')

    // Directly revoke ALL sessions for the user (simulating a "sign out
    // everywhere" admin action). The middleware's revocation check should
    // catch this on the very next request.
    const { getDb } = await import('../src/db/index.js')
    getDb()
      .prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ?`)
      .run(new Date().toISOString(), userId)

    const r = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(r.status).toBe(401)
    expect(r.body.error.message).toMatch(/revoked|sign in/i)
  })

  it('rejects an expired magic-link token', async () => {
    const app = makeApp()
    await request(app).post('/api/v1/auth/magic-link').send({ email: 'exp@example.com' })

    const { getDb } = await import('../src/db/index.js')
    const row = getDb()
      .prepare(`SELECT token FROM magic_link_tokens WHERE email = ?`)
      .get('exp@example.com') as { token: string }
    // Force the token expired.
    getDb()
      .prepare(`UPDATE magic_link_tokens SET expires_at = ? WHERE token = ?`)
      .run('2000-01-01T00:00:00Z', row.token)

    const r = await request(app).post('/api/v1/auth/verify').send({ token: row.token })
    expect(r.status).toBe(400)
    expect(r.body.error.message).toMatch(/expired/i)
  })

  it('rejects magic-link token with invalid format', async () => {
    const app = makeApp()
    const r = await request(app).post('/api/v1/auth/verify').send({ token: 'not-hex!' })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })

  it('magic-link endpoint returns 200 for unknown emails (no enumeration)', async () => {
    const app = makeApp()
    const r = await request(app)
      .post('/api/v1/auth/magic-link')
      .send({ email: 'never-seen@example.com' })
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
  })
})
