import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { mapSettings } from '../lib/mappers.js'

const router = Router()
router.use(authMiddleware)

const upsertSchema = z.object({
  locale: z.enum(['en', 'pt-BR']).optional(),
  default_reminder_lead_days: z.number().int().min(0).optional(),
})

function nowIso() {
  return new Date().toISOString()
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let row = getDb()
      .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
      .get(req.user!.id) as Parameters<typeof mapSettings>[0] | undefined
    if (!row) {
      const now = nowIso()
      getDb()
        .prepare(
          `INSERT INTO user_settings (user_id, locale, default_reminder_lead_days, created_at, updated_at)
           VALUES (?, 'en', 30, ?, ?)`
        )
        .run(req.user!.id, now, now)
      row = getDb()
        .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
        .get(req.user!.id) as Parameters<typeof mapSettings>[0]
    }
    res.json(mapSettings(row))
  })
)

router.put(
  '/',
  validateBody(upsertSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof upsertSchema>
    const now = nowIso()
    const existing = getDb()
      .prepare(`SELECT user_id FROM user_settings WHERE user_id = ?`)
      .get(req.user!.id)
    if (!existing) {
      getDb()
        .prepare(
          `INSERT INTO user_settings (user_id, locale, default_reminder_lead_days, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(req.user!.id, data.locale ?? 'en', data.default_reminder_lead_days ?? 30, now, now)
    } else {
      const fields: string[] = []
      const values: unknown[] = []
      if (data.locale !== undefined) {
        fields.push(`locale = ?`)
        values.push(data.locale)
      }
      if (data.default_reminder_lead_days !== undefined) {
        fields.push(`default_reminder_lead_days = ?`)
        values.push(data.default_reminder_lead_days)
      }
      if (fields.length > 0) {
        fields.push(`updated_at = ?`)
        values.push(now)
        values.push(req.user!.id)
        getDb()
          .prepare(`UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = ?`)
          .run(...values)
      }
    }
    const row = getDb()
      .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
      .get(req.user!.id) as Parameters<typeof mapSettings>[0]
    res.json(mapSettings(row))
  })
)

export default router
