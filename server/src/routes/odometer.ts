import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapOdometer } from '../lib/mappers.js'
import { assertOwnsVehicle } from './vehicles.js'
import { isoDateLike } from '../lib/validators.js'

// Two routers: nested under /vehicles/:id, and a flat one for /odometer-entries/:id
export const odometerNestedRouter = Router({ mergeParams: true })
odometerNestedRouter.use(authMiddleware)

export const odometerFlatRouter = Router()
odometerFlatRouter.use(authMiddleware)

const insertSchema = z
  .object({
    vehicle_id: z.string().uuid().optional(),
    reading_km: z.number().int().min(0).max(10_000_000),
    reading_date: isoDateLike,
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()

function nowIso() {
  return new Date().toISOString()
}

odometerNestedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.id
    assertOwnsVehicle(vehicleId, req.user!.id)
    const rows = getDb()
      .prepare(
        `SELECT * FROM odometer_entries WHERE vehicle_id = ? AND user_id = ? ORDER BY reading_date DESC`
      )
      .all(vehicleId, req.user!.id) as Parameters<typeof mapOdometer>[0][]
    res.json(rows.map(mapOdometer))
  })
)

odometerNestedRouter.post(
  '/',
  validateBody(insertSchema),
  asyncHandler(async (req, res) => {
    const vehicleId = req.params.id
    assertOwnsVehicle(vehicleId, req.user!.id)
    const data = req.body as z.infer<typeof insertSchema>
    const id = uuidv4()
    const now = nowIso()
    const db = getDb()
    // Single transaction: insert the entry, bump current_odometer if higher.
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO odometer_entries (id, vehicle_id, user_id, reading_km, reading_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, vehicleId, req.user!.id, data.reading_km, data.reading_date, data.notes ?? null, now)

      db.prepare(
        `UPDATE vehicles SET current_odometer = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND current_odometer < ?`
      ).run(data.reading_km, now, vehicleId, req.user!.id, data.reading_km)
    })
    tx()

    const row = db
      .prepare(`SELECT * FROM odometer_entries WHERE id = ?`)
      .get(id) as Parameters<typeof mapOdometer>[0]
    res.status(201).json(mapOdometer(row))
  })
)

const updateSchema = z
  .object({
    reading_km: z.number().int().min(0).max(10_000_000).optional(),
    reading_date: isoDateLike.optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()

const UPDATABLE_ODO_COLS = new Set(['reading_km', 'reading_date', 'notes'])

odometerFlatRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const existing = findOwnedOrThrow<Parameters<typeof mapOdometer>[0]>(
      'odometer_entries',
      req.params.id,
      req.user!.id
    )
    const data = req.body as z.infer<typeof updateSchema>
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!UPDATABLE_ODO_COLS.has(k)) continue
      fields.push(`${k} = ?`)
      values.push(v ?? null)
    }
    const db = getDb()
    if (fields.length > 0) {
      values.push(req.params.id, req.user!.id)
      db.prepare(
        `UPDATE odometer_entries SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`
      ).run(...values)

      // If the new reading is higher than the vehicle's current_odometer,
      // bump it. Single atomic UPDATE with the guard in WHERE — read-modify-write
      // here would race with concurrent writes from fuel/maintenance posts.
      const newKm = typeof data.reading_km === 'number' ? data.reading_km : existing.reading_km
      db.prepare(
        `UPDATE vehicles SET current_odometer = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND current_odometer < ?`
      ).run(newKm, new Date().toISOString(), existing.vehicle_id, req.user!.id, newKm)
    }
    const row = db
      .prepare(`SELECT * FROM odometer_entries WHERE id = ?`)
      .get(req.params.id) as Parameters<typeof mapOdometer>[0]
    res.json(mapOdometer(row))
  })
)

odometerFlatRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('odometer_entries', req.params.id, req.user!.id)
    getDb()
      .prepare(`DELETE FROM odometer_entries WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)
