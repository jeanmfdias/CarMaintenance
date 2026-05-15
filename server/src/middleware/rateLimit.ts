import rateLimit, { ipKeyGenerator, MemoryStore, type Options } from 'express-rate-limit'
import type { Request } from 'express'
import { config } from '../config.js'

/**
 * In-memory rate limiters. Suitable for single-process deployments only —
 * a horizontally scaled setup would need a shared store (Redis).
 *
 * In tests, the limiters are skipped by default (so signInAs() doesn't trip
 * the per-email magic-link cap when reused). Set TEST_RATE_LIMIT=on in a
 * specific test to exercise the limiters.
 */

const json429: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Return the same envelope shape as errorHandler.
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' },
    })
  },
}

const skipInTests = (_req: Request): boolean =>
  config.isTest && process.env.TEST_RATE_LIMIT !== 'on'

const magicLinkStore = new MemoryStore()
const verifyStore = new MemoryStore()
const apiStore = new MemoryStore()

export const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  store: magicLinkStore,
  keyGenerator: (req: Request) => {
    const e = (req.body?.email as string | undefined)?.trim().toLowerCase()
    if (e && e.length > 0) return `email:${e}`
    return `ip:${ipKeyGenerator(req.ip ?? '')}`
  },
  skip: skipInTests,
  ...json429,
})

export const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: verifyStore,
  keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
  skip: skipInTests,
  ...json429,
})

/**
 * Looser global limiter for all /api/v1 routes. Defends against runaway
 * scrapers without throttling normal interactive use. Config-driven so
 * deployments behind tight WAFs can tune or disable it.
 */
const API_LIMIT = Number(process.env.RATE_LIMIT_API_MAX ?? 300)
const API_WINDOW_MS = Number(process.env.RATE_LIMIT_API_WINDOW_MS ?? 15 * 60 * 1000)

export const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: API_LIMIT,
  store: apiStore,
  keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
  // Health probes and version checks bypass the limiter so a chatty
  // monitoring agent can't lock real users out.
  skip: (req: Request) => {
    if (skipInTests(req)) return true
    if (req.path === '/version') return true
    return false
  },
  ...json429,
})

/** Test-only: reset counters so the rate-limit suite can run deterministically. */
export function _resetRateLimitForTests(): void {
  // MemoryStore exposes resetAll() at runtime; the TS type is incomplete in some versions.
  ;(magicLinkStore as unknown as { resetAll?: () => void }).resetAll?.()
  ;(verifyStore as unknown as { resetAll?: () => void }).resetAll?.()
  ;(apiStore as unknown as { resetAll?: () => void }).resetAll?.()
}
