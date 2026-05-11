import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapFuel, toBoolInt } from '../lib/mappers.js'
import { assertOwnsVehicle } from './vehicles.js'

export const fuelNestedRouter = Router({ mergeParams: true })
fuelNestedRouter.use(authMiddleware)

export const fuelFlatRouter = Router()
fuelFlatRouter.use(authMiddleware)

const fuelTypeSchema = z.enum(['gasoline', 'diesel', 'ethanol', 'flex', 'electric', 'hybrid'])

const insertSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  fillup_date: z.string().min(8),
  odometer_km: z.number().int().min(0),
  liters: z.number().positive(),
  total_cost: z.number().min(0),
  fuel_type: fuelTypeSchema.nullable().optional(),
  full_tank: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})

const updateSchema = insertSchema.partial()

function nowIso() {
  return new Date().toISOString()
}

fuelNestedRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const rows = getDb()
      .prepare(
        `SELECT * FROM fuel_fillups WHERE vehicle_id = ? AND user_id = ? ORDER BY odometer_km ASC`
      )
      .all(req.params.id, req.user!.id) as Parameters<typeof mapFuel>[0][]
    res.json(rows.map(mapFuel))
  })
)

fuelNestedRouter.post(
  '/',
  validateBody(insertSchema),
  asyncHandler(async (req, res) => {
    assertOwnsVehicle(req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof insertSchema>
    const id = uuidv4()
    const now = nowIso()
    getDb()
      .prepare(
        `INSERT INTO fuel_fillups
          (id, vehicle_id, user_id, fillup_date, odometer_km, liters, total_cost,
           fuel_type, full_tank, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        req.params.id,
        req.user!.id,
        data.fillup_date,
        data.odometer_km,
        data.liters,
        data.total_cost,
        data.fuel_type ?? null,
        toBoolInt(data.full_tank, true),
        data.notes ?? null,
        now,
        now
      )

    // Sync vehicle current_odometer if higher
    getDb()
      .prepare(
        `UPDATE vehicles SET current_odometer = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND current_odometer < ?`
      )
      .run(data.odometer_km, now, req.params.id, req.user!.id, data.odometer_km)

    // Mirror an odometer entry
    getDb()
      .prepare(
        `INSERT INTO odometer_entries (id, vehicle_id, user_id, reading_km, reading_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(uuidv4(), req.params.id, req.user!.id, data.odometer_km, data.fillup_date, null, now)

    const row = getDb().prepare(`SELECT * FROM fuel_fillups WHERE id = ?`).get(id) as Parameters<
      typeof mapFuel
    >[0]
    res.status(201).json(mapFuel(row))
  })
)

fuelFlatRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = findOwnedOrThrow<Parameters<typeof mapFuel>[0]>(
      'fuel_fillups',
      req.params.id,
      req.user!.id
    )
    res.json(mapFuel(row))
  })
)

fuelFlatRouter.patch(
  '/:id',
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('fuel_fillups', req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof updateSchema>
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (k === 'full_tank') {
        fields.push(`full_tank = ?`)
        values.push(toBoolInt(v as boolean, true))
      } else {
        fields.push(`${k} = ?`)
        values.push(v ?? null)
      }
    }
    if (fields.length > 0) {
      fields.push(`updated_at = ?`)
      values.push(nowIso())
      values.push(req.params.id, req.user!.id)
      getDb()
        .prepare(`UPDATE fuel_fillups SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
        .run(...values)
    }
    const row = getDb()
      .prepare(`SELECT * FROM fuel_fillups WHERE id = ?`)
      .get(req.params.id) as Parameters<typeof mapFuel>[0]
    res.json(mapFuel(row))
  })
)

fuelFlatRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('fuel_fillups', req.params.id, req.user!.id)
    getDb()
      .prepare(`DELETE FROM fuel_fillups WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)
