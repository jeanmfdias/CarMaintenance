import type { Request, Response, NextFunction } from 'express'
import { verifyJwt } from '../lib/jwt.js'
import { unauthorized } from '../lib/errors.js'
import { getDb } from '../db/index.js'

export interface AuthedUser {
  id: string
  email: string
  sid?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? req.header('Authorization')
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Missing or invalid Authorization header'))
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) return next(unauthorized('Missing bearer token'))

  try {
    const payload = verifyJwt(token)
    if (!payload?.sub || !payload?.email) {
      return next(unauthorized('Invalid token payload'))
    }
    // Optional revocation check via session id
    if (payload.sid) {
      const row = getDb()
        .prepare(`SELECT revoked_at FROM auth_sessions WHERE id = ?`)
        .get(payload.sid) as { revoked_at: string | null } | undefined
      if (row?.revoked_at) {
        return next(unauthorized('Session has been revoked'))
      }
    }
    req.user = { id: payload.sub, email: payload.email, sid: payload.sid }
    next()
  } catch (err) {
    const name = (err as Error).name
    if (name === 'TokenExpiredError') {
      return next(unauthorized('Your session has expired. Please sign in again.'))
    }
    return next(unauthorized('Invalid or expired token. Please sign in again.'))
  }
}
