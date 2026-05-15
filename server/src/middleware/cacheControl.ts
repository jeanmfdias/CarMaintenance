import type { Request, Response, NextFunction } from 'express'

/**
 * Prevent intermediaries (and the SPA's service-worker fetch cache) from
 * holding on to authenticated responses. Applied to /api/v1 — never to
 * /uploads (those are user-photo binaries served with sendFile() and benefit
 * from the browser's normal caching).
 */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store')
  next()
}
