import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapMaintenance, toBoolInt } from '../lib/mappers.js'
import { assertOwnsVehicle } from './vehicles.js'
import { syncOdometerOnRecord } from '../lib/odometerSync.js'
import { isoDateLike } from '../lib/validators.js'

export const maintenanceNestedRouter = Router({ mergeParams: true })
maintenanceNestedRouter.use(authMiddleware)

export const maintenanceFlatRouter = Router()
maintenanceFlatRouter.use(authMiddleware)

const categorySchema = z.enum([
  'oil_change',
  'tire_service',
  'brake_service',
  'general_repair',
  'scheduled_service',
  'taxes_fees',
  'insurance',
  'labor',
  'accessories',
  'fuel',
  'other',
])

const insertSchema = z
  .object({
    vehicle_id: z.string().uuid().optional(),
    service_provider_id: z.string().uuid().nullable().optional(),
    category: categorySchema,
    record_date: isoDateLike,
    odometer_km: z.number().int().min(0).max(10_000_000).nullable().optional(),
    total_cost: z.number().min(0).max(10_000_000),
    labor_cost: z.number().min(0).max(10_000_000).nullable().optional(),
    parts_cost: z.number().min(0).max(10_000_000).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    next_service_date: isoDateLike.nullable().optional(),
    next_service_km: z.number().int().min(0).max(10_000_000).nullable().optional(),
    reminder_lead_days: z.number().int().min(0).max(3650).default(30),
  })
  .strict()

const updateSchema = insertSchema
  .partial()
  .extend({ reminder_sent: z.boolean().optional() })
  .strict()

const UPDATABLE_MAINT_COLS = new Set([
  'vehicle_id',
  'service_provider_id',
  'category',
  'record_date',
  'odometer_km',
  'total_cost',
  'labor_cost',
  'parts_cost',
  'notes',
  'next_service_date',
  'next_service_km',
  'reminder_lead_days',
  'reminder_sent',
])

function nowIso() {
  return new Date().toISOString()
}

maintenanceNestedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const rows = getDb()
      .prepare(
        `SELECT * FROM maintenance_records
         WHERE vehicle_id = ? AND user_id = ?
         ORDER BY record_date DESC`
      )
      .all(req.params.id, req.user!.id) as Parameters<typeof mapMaintenance>[0][]
    res.json(rows.map(mapMaintenance))
  })
)

maintenanceNestedRouter.post(
  '/',
  validateBody(insertSchema),
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof insertSchema>
    // A referenced service provider must belong to the caller. Throws 404
    // (not 403) so we never leak the existence of another user's provider.
    if (data.service_provider_id) {
      findOwnedOrThrow('service_providers', data.service_provider_id, req.user!.id)
    }
    const id = uuidv4()
    const now = nowIso()
    getDb()
      .prepare(
        `INSERT INTO maintenance_records
          (id, vehicle_id, user_id, service_provider_id, category, record_date,
           odometer_km, total_cost, labor_cost, parts_cost, notes,
           next_service_date, next_service_km, reminder_lead_days, reminder_sent,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        req.params.id,
        req.user!.id,
        data.service_provider_id ?? null,
        data.category,
        data.record_date,
        data.odometer_km ?? null,
        data.total_cost,
        data.labor_cost ?? null,
        data.parts_cost ?? null,
        data.notes ?? null,
        data.next_service_date ?? null,
        data.next_service_km ?? null,
        data.reminder_lead_days,
        now,
        now
      )

    // Server-side rule: any record carrying an odometer reading bumps the
    // vehicle's current_odometer (if higher) and mirrors an odometer_entries
    // row, deduped on (vehicle, date, km).
    if (typeof data.odometer_km === 'number') {
      syncOdometerOnRecord({
        userId: req.user!.id,
        vehicleId: req.params.id,
        reading_km: data.odometer_km,
        reading_date: data.record_date,
      })
    }

    const row = getDb().prepare(`SELECT * FROM maintenance_records WHERE id = ?`).get(id) as Parameters<
      typeof mapMaintenance
    >[0]
    res.status(201).json(mapMaintenance(row))
  })
)

maintenanceFlatRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = findOwnedOrThrow<Parameters<typeof mapMaintenance>[0]>(
      'maintenance_records',
      req.params.id,
      req.user!.id
    )
    res.json(mapMaintenance(row))
  })
)

maintenanceFlatRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('maintenance_records', req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof updateSchema>
    // Reassigning the record to another vehicle or provider requires owning
    // the target too — otherwise a user could relink their row to someone
    // else's vehicle/provider. 404 keeps existence of others' rows hidden.
    if (data.vehicle_id !== undefined) {
      assertOwnsVehicle(data.vehicle_id, req.user!.id)
    }
    if (data.service_provider_id) {
      findOwnedOrThrow('service_providers', data.service_provider_id, req.user!.id)
    }
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!UPDATABLE_MAINT_COLS.has(k)) continue
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
        .prepare(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
        .run(...values)
    }
    const row = getDb()
      .prepare(`SELECT * FROM maintenance_records WHERE id = ?`)
      .get(req.params.id) as Parameters<typeof mapMaintenance>[0]
    res.json(mapMaintenance(row))
  })
)

maintenanceFlatRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('maintenance_records', req.params.id, req.user!.id)
    getDb()
      .prepare(`DELETE FROM maintenance_records WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)
