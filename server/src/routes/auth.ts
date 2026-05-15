import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { getDb } from '../db/index.js'
import { config } from '../config.js'
import { signJwt } from '../lib/jwt.js'
import { sendMagicLink } from '../lib/mail.js'
import { validateBody } from '../middleware/validate.js'
import { authMiddleware } from '../middleware/auth.js'
import { magicLinkLimiter, verifyLimiter } from '../middleware/rateLimit.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { unauthorized, badRequest } from '../lib/errors.js'

const router = Router()

const magicLinkSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
  })
  .strict()

const verifySchema = z
  .object({
    // Token is 64 hex chars (32 bytes from randomBytes).
    token: z.string().regex(/^[a-f0-9]{32,128}$/i, 'invalid token format'),
  })
  .strict()

function nowIso(): string {
  return new Date().toISOString()
}

function ensureUser(email: string): { id: string; email: string } {
  const db = getDb()
  const existing = db.prepare(`SELECT id, email FROM users WHERE email = ?`).get(email) as
    | { id: string; email: string }
    | undefined
  if (existing) return existing
  const id = uuidv4()
  const now = nowIso()
  db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(
    id,
    email,
    now,
    now
  )
  // Default user_settings
  db.prepare(
    `INSERT INTO user_settings (user_id, locale, default_reminder_lead_days, created_at, updated_at)
     VALUES (?, 'en', 30, ?, ?)`
  ).run(id, now, now)
  return { id, email }
}

/**
 * Constant-time compare of two ASCII strings of arbitrary length.
 * Avoids timing side-channel that would let an attacker discover token prefixes.
 */
function safeEqualStr(a: string, b: string): boolean {
  // Normalize to a fixed-length digest before comparing so the timing depends
  // only on the digest length, not the inputs.
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

router.post(
  '/magic-link',
  magicLinkLimiter,
  validateBody(magicLinkSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as z.infer<typeof magicLinkSchema>
    const db = getDb()

    // Always behave the same regardless of existence — but we still need a user row to attach the token to.
    const user = ensureUser(email)

    // 32 bytes => 64 hex chars of crypto-random entropy.
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + config.magicLinkTtlMin * 60_000).toISOString()
    db.prepare(
      `INSERT INTO magic_link_tokens (token, user_id, email, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(token, user.id, email, expiresAt, nowIso())

    const link = `${config.publicAppUrl.replace(/\/$/, '')}/auth/callback?token=${token}`
    try {
      await sendMagicLink(email, link)
    } catch (e) {
      console.error('[auth/magic-link] mail send failed', (e as Error).message)
    }

    res.json({ ok: true })
  })
)

router.post(
  '/verify',
  verifyLimiter,
  validateBody(verifySchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body as z.infer<typeof verifySchema>
    const db = getDb()
    const row = db
      .prepare(
        `SELECT token, user_id, email, expires_at, consumed_at FROM magic_link_tokens WHERE token = ?`
      )
      .get(token) as
      | {
          token: string
          user_id: string
          email: string
          expires_at: string
          consumed_at: string | null
        }
      | undefined

    if (!row) throw badRequest('Invalid or unknown token')
    // Constant-time confirmation that the row's token matches the supplied token.
    // (The lookup itself is already keyed on `token`, but verifying with a
    // timing-safe compare keeps the contract explicit and defends against any
    // future change that broadens the lookup.)
    if (!safeEqualStr(row.token, token)) throw badRequest('Invalid or unknown token')
    if (row.consumed_at) throw badRequest('Token has already been used')
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw badRequest('Token has expired. Please request a new sign-in link.')
    }

    const now = nowIso()
    db.prepare(`UPDATE magic_link_tokens SET consumed_at = ? WHERE token = ?`).run(now, token)

    const sid = uuidv4()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(
      `INSERT INTO auth_sessions (id, user_id, issued_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(sid, row.user_id, now, expiresAt)

    const access_token = signJwt({ sub: row.user_id, email: row.email, sid })

    res.json({
      access_token,
      user: { id: row.user_id, email: row.email },
    })
  })
)

router.post(
  '/logout',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const sid = req.user?.sid
    if (sid) {
      getDb().prepare(`UPDATE auth_sessions SET revoked_at = ? WHERE id = ?`).run(nowIso(), sid)
    }
    res.json({ ok: true })
  })
)

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized()
    const row = getDb()
      .prepare(`SELECT id, email, created_at, updated_at FROM users WHERE id = ?`)
      .get(req.user.id)
    if (!row) throw unauthorized()
    res.json({ user: row })
  })
)

export default router
