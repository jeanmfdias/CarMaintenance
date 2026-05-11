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

// Two routers: nested under /vehicles/:id, and a flat one for /odometer-entries/:id
export const odometerNestedRouter = Router({ mergeParams: true })
odometerNestedRouter.use(authMiddleware)

export const odometerFlatRouter = Router()
odometerFlatRouter.use(authMiddleware)

const insertSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  reading_km: z.number().int().min(0),
  reading_date: z.string().min(8),
  notes: z.string().nullable().optional(),
})

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
    getDb()
      .prepare(
        `INSERT INTO odometer_entries (id, vehicle_id, user_id, reading_km, reading_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, vehicleId, req.user!.id, data.reading_km, data.reading_date, data.notes ?? null, now)
    const row = getDb()
      .prepare(`SELECT * FROM odometer_entries WHERE id = ?`)
      .get(id) as Parameters<typeof mapOdometer>[0]
    res.status(201).json(mapOdometer(row))
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
