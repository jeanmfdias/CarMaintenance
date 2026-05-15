import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Per-request opaque id, echoed in X-Request-ID. Useful for log correlation. */
      id: string
    }
  }
}

/**
 * Assigns a per-request UUID (or trusts an incoming X-Request-ID from a
 * reverse proxy if it looks safe) and echoes it back as a response header.
 *
 * Only accepts an incoming header value when it matches a conservative
 * allow-list (UUID, hex, or short safe slug) — otherwise mints our own to
 * avoid attacker-controlled values leaking into logs.
 */
const SAFE_RID = /^[A-Za-z0-9._-]{8,128}$/

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = (req.header('x-request-id') ?? '').trim()
  const id = incoming && SAFE_RID.test(incoming) ? incoming : randomUUID()
  req.id = id
  res.setHeader('X-Request-ID', id)
  next()
}
