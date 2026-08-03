import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * TRUST_PROXY hardening: a blanket `true` makes X-Forwarded-For spoofable and
 * would let clients forge their IP to bypass per-IP rate limits. In production
 * the config layer must refuse to boot on it and only accept an explicit hop
 * count / subnet / false.
 *
 * config.ts reads process.env at import time, so each case mutates env, resets
 * the module registry, and re-imports. Env is restored after every test.
 */
const OLD_ENV = { ...process.env }

afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k]
  Object.assign(process.env, OLD_ENV)
  vi.resetModules()
})

async function loadConfig() {
  vi.resetModules()
  const mod = await import('../src/config.js')
  return mod.config
}

describe('config TRUST_PROXY hardening', () => {
  it('refuses to boot in production when TRUST_PROXY=true', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(40)
    process.env.TRUST_PROXY = 'true'
    await expect(loadConfig()).rejects.toThrow(/TRUST_PROXY=true/)
  })

  it('accepts an explicit hop count in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(40)
    process.env.TRUST_PROXY = '1'
    const config = await loadConfig()
    expect(config.trustProxy).toBe(1)
  })

  it('defaults to false (no proxy trusted) when unset', async () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_SECRET = 'x'.repeat(40)
    delete process.env.TRUST_PROXY
    const config = await loadConfig()
    expect(config.trustProxy).toBe(false)
  })

  it('allows TRUST_PROXY=true outside production (dev convenience)', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.JWT_SECRET
    process.env.TRUST_PROXY = 'true'
    const config = await loadConfig()
    expect(config.trustProxy).toBe(true)
  })
})
