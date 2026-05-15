import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp } from './helpers.js'

describe('observability', () => {
  it('assigns a fresh X-Request-ID when none is provided', async () => {
    const app = makeApp()
    const r = await request(app).get('/health')
    expect(r.status).toBe(200)
    const rid = r.headers['x-request-id']
    expect(typeof rid).toBe('string')
    // RFC 4122 v4 shape — the middleware uses randomUUID().
    expect(rid).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('echoes a safe inbound X-Request-ID back unchanged', async () => {
    const app = makeApp()
    const r = await request(app).get('/health').set('X-Request-ID', 'abcdef-1234')
    expect(r.headers['x-request-id']).toBe('abcdef-1234')
  })

  it('replaces an unsafe inbound X-Request-ID', async () => {
    const app = makeApp()
    const r = await request(app)
      .get('/health')
      .set('X-Request-ID', '<script>alert(1)</script>')
    expect(r.headers['x-request-id']).not.toContain('<')
    expect(r.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('sets Cache-Control: no-store on /api/v1 responses', async () => {
    const app = makeApp()
    const r = await request(app).get('/api/v1/version')
    expect(r.headers['cache-control']).toBe('no-store')
  })
})
