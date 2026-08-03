import './setup.js'
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { makeApp } from './helpers.js'
import { config } from '../src/config.js'

/**
 * CORS must never combine a wildcard/reflected origin with
 * Access-Control-Allow-Credentials: true — that pairing lets any website make
 * credentialed cross-origin requests. These tests pin that invariant.
 *
 * config.corsOrigins is mutated in-place per test and restored afterwards; the
 * delegate in app.ts reads it live on each request.
 */
describe('CORS credentials handling', () => {
  const original = [...config.corsOrigins]
  afterEach(() => {
    config.corsOrigins.splice(0, config.corsOrigins.length, ...original)
  })

  it('reflects an explicitly allow-listed origin WITH credentials', async () => {
    const res = await request(makeApp())
      .get('/api/v1/version')
      .set('Origin', 'http://localhost:5173')
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(res.headers['access-control-allow-credentials']).toBe('true')
  })

  it('never sends Allow-Credentials when wildcard "*" is configured', async () => {
    config.corsOrigins.splice(0, config.corsOrigins.length, '*')
    const res = await request(makeApp())
      .get('/api/v1/version')
      .set('Origin', 'https://evil.example.com')
    // The wildcard still allows the request through ...
    expect(res.status).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBeDefined()
    // ... but the dangerous credentials pairing must be absent.
    expect(res.headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('blocks a non-allow-listed origin when no wildcard is set', async () => {
    const res = await request(makeApp())
      .get('/api/v1/version')
      .set('Origin', 'https://evil.example.com')
    expect(res.status).toBe(403)
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('allows credentialless no-Origin requests (curl/healthcheck)', async () => {
    const res = await request(makeApp()).get('/api/v1/version')
    expect(res.status).toBe(200)
  })
})
