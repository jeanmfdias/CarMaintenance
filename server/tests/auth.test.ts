import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('auth', () => {
  it('happy path: magic-link -> verify -> me', async () => {
    const app = makeApp()

    const linkRes = await request(app)
      .post('/api/v1/auth/magic-link')
      .send({ email: 'alice@example.com' })
    expect(linkRes.status).toBe(200)
    expect(linkRes.body.ok).toBe(true)

    const { token } = await signInAs(app, 'alice@example.com')
    expect(token).toBeTruthy()

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(meRes.status).toBe(200)
    expect(meRes.body.user.email).toBe('alice@example.com')
  })

  it('rejects requests without a token', async () => {
    const app = makeApp()
    const res = await request(app).get('/api/v1/vehicles')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('unauthorized')
  })

  it('rejects an invalid token with a friendly message', async () => {
    const app = makeApp()
    const res = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', 'Bearer not-a-jwt')
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/sign in/i)
  })

  it('rejects a token after logout', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'bob@example.com')

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
    expect(out.status).toBe(200)

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(me.status).toBe(401)
  })

  it('does not allow re-using a magic-link token', async () => {
    const app = makeApp()
    await request(app).post('/api/v1/auth/magic-link').send({ email: 'eve@example.com' })

    const { getDb } = await import('../src/db/index.js')
    const row = getDb()
      .prepare(
        `SELECT token FROM magic_link_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get('eve@example.com') as { token: string }

    const ok = await request(app).post('/api/v1/auth/verify').send({ token: row.token })
    expect(ok.status).toBe(200)

    const again = await request(app).post('/api/v1/auth/verify').send({ token: row.token })
    expect(again.status).toBe(400)
  })
})
