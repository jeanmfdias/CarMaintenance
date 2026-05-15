import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/errors.js'
import { config } from '../config.js'

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'not_found', message: `Route ${req.method} ${req.path} not found` },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        details: err.flatten(),
      },
    })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  // Multer file-size / file-count limits.
  const e = err as { code?: string; field?: string; message?: string }
  if (e?.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: 'Uploaded file is too large' },
    })
    return
  }
  if (e?.code === 'LIMIT_UNEXPECTED_FILE' || e?.code === 'LIMIT_FILE_COUNT' || e?.code === 'LIMIT_FIELD_COUNT') {
    res.status(400).json({
      error: { code: 'bad_upload', message: 'Unexpected upload field or too many files' },
    })
    return
  }

  // express.json() body too large.
  if ((err as { type?: string })?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: 'Request body too large' },
    })
    return
  }

  // CORS rejections from cors's origin() callback.
  if (err instanceof Error && /not allowed by CORS/i.test(err.message)) {
    res.status(403).json({ error: { code: 'forbidden', message: 'Origin not allowed' } })
    return
  }

  // Unexpected error — do not leak details in production.
  // Log full server-side with enough context to find the request in traces;
  // respond generically to the client.
  const ctx = {
    rid: req.id ?? '-',
    method: req.method,
    path: req.originalUrl,
    uid: req.user?.id ?? '-',
  }
  if (err instanceof Error) {
    console.error('[unhandled-error]', JSON.stringify(ctx), err.stack ?? err.message)
  } else {
    console.error('[unhandled-error]', JSON.stringify(ctx), err)
  }
  if (config.isProd) {
    res.status(500).json({
      error: { code: 'internal_error', message: 'Internal server error' },
    })
    return
  }
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Internal server error',
      details: err instanceof Error ? { name: err.name, message: err.message } : undefined,
    },
  })
}
