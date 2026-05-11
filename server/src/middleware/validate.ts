import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) return next(result.error)
    req.body = result.data
    next()
  }

export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) return next(result.error)
    Object.assign(req.query, result.data as Record<string, unknown>)
    next()
  }
