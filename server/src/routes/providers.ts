import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapProvider } from '../lib/mappers.js'

const router = Router()
router.use(authMiddleware)

const insertSchema = z
  .object({
    name: z.string().min(1).max(200),
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    email: z.string().max(200).nullable().optional(),
    website: z.string().max(500).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .strict()
const updateSchema = insertSchema.partial().strict()

const UPDATABLE_COLS = new Set(['name', 'address', 'phone', 'email', 'website', 'notes'])

function nowIso() {
  return new Date().toISOString()
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = getDb()
      .prepare(`SELECT * FROM service_providers WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC`)
      .all(req.user!.id) as Parameters<typeof mapProvider>[0][]
    res.json(rows.map(mapProvider))
  })
)

router.post(
  '/',
  validateBody(insertSchema),
  asyncHandler(async (req, res) => {
    const id = uuidv4()
    const now = nowIso()
    const data = req.body as z.infer<typeof insertSchema>
    getDb()
      .prepare(
        `INSERT INTO service_providers (id, user_id, name, address, phone, email, website, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        req.user!.id,
        data.name,
        data.address ?? null,
        data.phone ?? null,
        data.email ?? null,
        data.website ?? null,
        data.notes ?? null,
        now,
        now
      )
    const row = getDb().prepare(`SELECT * FROM service_providers WHERE id = ?`).get(id) as Parameters<
      typeof mapProvider
    >[0]
    res.status(201).json(mapProvider(row))
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = findOwnedOrThrow<Parameters<typeof mapProvider>[0]>(
      'service_providers',
      req.params.id,
      req.user!.id
    )
    res.json(mapProvider(row))
  })
)

router.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('service_providers', req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof updateSchema>
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!UPDATABLE_COLS.has(k)) continue
      fields.push(`${k} = ?`)
      values.push(v ?? null)
    }
    if (fields.length > 0) {
      fields.push(`updated_at = ?`)
      values.push(nowIso(), req.params.id, req.user!.id)
      getDb()
        .prepare(`UPDATE service_providers SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
        .run(...values)
    }
    const row = getDb()
      .prepare(`SELECT * FROM service_providers WHERE id = ?`)
      .get(req.params.id) as Parameters<typeof mapProvider>[0]
    res.json(mapProvider(row))
  })
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('service_providers', req.params.id, req.user!.id)
    getDb()
      .prepare(`DELETE FROM service_providers WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)

export default router
