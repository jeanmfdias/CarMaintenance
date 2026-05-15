import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapInsurance, toBoolInt } from '../lib/mappers.js'
import { assertOwnsVehicle } from './vehicles.js'
import { isoDateLike } from '../lib/validators.js'

export const insuranceNestedRouter = Router({ mergeParams: true })
insuranceNestedRouter.use(authMiddleware)

export const insuranceFlatRouter = Router()
insuranceFlatRouter.use(authMiddleware)

const insertSchema = z
  .object({
    vehicle_id: z.string().uuid().optional(),
    insurer: z.string().min(1).max(200),
    policy_number: z.string().max(200).nullable().optional(),
    start_date: isoDateLike,
    expiry_date: isoDateLike,
    annual_cost: z.number().min(0).max(10_000_000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    reminder_lead_days: z.number().int().min(0).max(3650).default(30),
  })
  .strict()

const updateSchema = insertSchema
  .partial()
  .extend({ reminder_sent: z.boolean().optional() })
  .strict()

const UPDATABLE_COLS = new Set([
  'vehicle_id',
  'insurer',
  'policy_number',
  'start_date',
  'expiry_date',
  'annual_cost',
  'notes',
  'reminder_lead_days',
  'reminder_sent',
])

function nowIso() {
  return new Date().toISOString()
}

insuranceNestedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const rows = getDb()
      .prepare(
        `SELECT * FROM insurance_policies WHERE vehicle_id = ? AND user_id = ? ORDER BY expiry_date ASC`
      )
      .all(req.params.id, req.user!.id) as Parameters<typeof mapInsurance>[0][]
    res.json(rows.map(mapInsurance))
  })
)

insuranceNestedRouter.post(
  '/',
  validateBody(insertSchema),
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof insertSchema>
    const id = uuidv4()
    const now = nowIso()
    getDb()
      .prepare(
        `INSERT INTO insurance_policies
          (id, vehicle_id, user_id, insurer, policy_number, start_date, expiry_date,
           annual_cost, notes, reminder_lead_days, reminder_sent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        req.params.id,
        req.user!.id,
        data.insurer,
        data.policy_number ?? null,
        data.start_date,
        data.expiry_date,
        data.annual_cost ?? null,
        data.notes ?? null,
        data.reminder_lead_days,
        now,
        now
      )
    const row = getDb()
      .prepare(`SELECT * FROM insurance_policies WHERE id = ?`)
      .get(id) as Parameters<typeof mapInsurance>[0]
    res.status(201).json(mapInsurance(row))
  })
)

insuranceFlatRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = findOwnedOrThrow<Parameters<typeof mapInsurance>[0]>(
      'insurance_policies',
      req.params.id,
      req.user!.id
    )
    res.json(mapInsurance(row))
  })
)

insuranceFlatRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('insurance_policies', req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof updateSchema>
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!UPDATABLE_COLS.has(k)) continue
      if (k === 'reminder_sent') {
        fields.push(`reminder_sent = ?`)
        values.push(toBoolInt(v as boolean))
      } else {
        fields.push(`${k} = ?`)
        values.push(v ?? null)
      }
    }
    if (fields.length > 0) {
      fields.push(`updated_at = ?`)
      values.push(nowIso(), req.params.id, req.user!.id)
      getDb()
        .prepare(`UPDATE insurance_policies SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
        .run(...values)
    }
    const row = getDb()
      .prepare(`SELECT * FROM insurance_policies WHERE id = ?`)
      .get(req.params.id) as Parameters<typeof mapInsurance>[0]
    res.json(mapInsurance(row))
  })
)

insuranceFlatRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('insurance_policies', req.params.id, req.user!.id)
    getDb()
      .prepare(`DELETE FROM insurance_policies WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)
