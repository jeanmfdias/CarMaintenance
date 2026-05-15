import { Router } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { getDb } from '../db/index.js'
import { config } from '../config.js'
import { authMiddleware } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { findOwnedOrThrow } from '../lib/ownership.js'
import { mapVehicle } from '../lib/mappers.js'
import { badRequest, notFound } from '../lib/errors.js'
import { isoDateLike } from '../lib/validators.js'
import { sniffImageMime } from '../lib/imageSniff.js'

const router = Router()
router.use(authMiddleware)

const fuelTypeSchema = z.enum(['gasoline', 'diesel', 'ethanol', 'flex', 'electric', 'hybrid'])

const vehicleInsertSchema = z
  .object({
    make: z.string().min(1).max(100),
    model: z.string().min(1).max(100),
    manufacture_year: z.number().int().min(1900).max(2100),
    model_year: z.number().int().min(1900).max(2100),
    purchase_date: isoDateLike.nullable().optional(),
    sell_date: isoDateLike.nullable().optional(),
    fuel_type: fuelTypeSchema,
    photo_url: z.string().max(500).nullable().optional(),
    current_odometer: z.number().int().min(0).max(10_000_000),
    notes: z.string().max(4000).nullable().optional(),
  })
  .strict()

const vehicleUpdateSchema = vehicleInsertSchema.partial().strict()

const UPDATABLE_VEHICLE_COLS = new Set([
  'make',
  'model',
  'manufacture_year',
  'model_year',
  'purchase_date',
  'sell_date',
  'fuel_type',
  'photo_url',
  'current_odometer',
  'notes',
])

function nowIso() {
  return new Date().toISOString()
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = getDb()
      .prepare(`SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC`)
      .all(req.user!.id) as Parameters<typeof mapVehicle>[0][]
    res.json(rows.map(mapVehicle))
  })
)

router.post(
  '/',
  validateBody(vehicleInsertSchema),
  asyncHandler(async (req, res) => {
    const id = uuidv4()
    const now = nowIso()
    const v = req.body as z.infer<typeof vehicleInsertSchema>
    getDb()
      .prepare(
        `INSERT INTO vehicles (id, user_id, make, model, manufacture_year, model_year,
          purchase_date, sell_date, fuel_type, photo_url, current_odometer, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        req.user!.id,
        v.make,
        v.model,
        v.manufacture_year,
        v.model_year,
        v.purchase_date ?? null,
        v.sell_date ?? null,
        v.fuel_type,
        v.photo_url ?? null,
        v.current_odometer,
        v.notes ?? null,
        now,
        now
      )
    const row = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(id) as Parameters<
      typeof mapVehicle
    >[0]
    res.status(201).json(mapVehicle(row))
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = findOwnedOrThrow<Parameters<typeof mapVehicle>[0]>(
      'vehicles',
      req.params.id,
      req.user!.id
    )
    res.json(mapVehicle(row))
  })
)

router.patch(
  '/:id',
  validateBody(vehicleUpdateSchema),
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('vehicles', req.params.id, req.user!.id)
    const data = req.body as z.infer<typeof vehicleUpdateSchema>
    const fields: string[] = []
    const values: unknown[] = []
    for (const [k, v] of Object.entries(data)) {
      if (!UPDATABLE_VEHICLE_COLS.has(k)) continue
      fields.push(`${k} = ?`)
      values.push(v ?? null)
    }
    if (fields.length === 0) {
      const row = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(req.params.id) as Parameters<
        typeof mapVehicle
      >[0]
      res.json(mapVehicle(row))
      return
    }
    fields.push(`updated_at = ?`)
    values.push(nowIso(), req.params.id, req.user!.id)
    getDb()
      .prepare(`UPDATE vehicles SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...values)
    const row = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(req.params.id) as Parameters<
      typeof mapVehicle
    >[0]
    res.json(mapVehicle(row))
  })
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    findOwnedOrThrow('vehicles', req.params.id, req.user!.id)
    getDb().prepare(`DELETE FROM vehicles WHERE id = ? AND user_id = ?`).run(req.params.id, req.user!.id)
    res.status(204).end()
  })
)

// ---- Photo upload ----

// Map of accepted image MIME types -> safe extension we *write* to disk.
// Filename extension always derives from the validated MIME, never the client filename.
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB — keeps storage and bandwidth sane
    files: 1,
    fields: 0,
  },
  fileFilter: (_req, file, cb) => {
    // First-pass check on the client-declared MIME — saves us from buffering
    // an obvious mismatch. The authoritative check is byte sniffing below.
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(null, false)
    }
    cb(null, true)
  },
})

router.post(
  '/:id/photo',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const vehicle = findOwnedOrThrow<Parameters<typeof mapVehicle>[0]>(
      'vehicles',
      req.params.id,
      req.user!.id
    )
    if (!req.file) {
      throw badRequest('Missing or unsupported file (expected form field "file" with a JPEG/PNG/WebP image)')
    }
    // Authoritative MIME comes from sniffing the buffer's magic bytes —
    // never trust the client-declared Content-Type. Refuse if either the
    // sniff fails or the sniffed type isn't in our allow-list.
    // TODO: strip EXIF on JPEGs (privacy). Out of scope for now.
    const sniffed = sniffImageMime(req.file.buffer)
    if (!sniffed) {
      throw badRequest('Uploaded file is not a recognized JPEG, PNG or WebP image')
    }
    const ext = ALLOWED_MIME[sniffed]
    if (!ext) throw badRequest(`Unsupported image type: ${sniffed}`)

    const userDir = path.join(config.uploadsDir, req.user!.id)
    fs.mkdirSync(userDir, { recursive: true })

    // Remove any prior file with a different extension to avoid orphans
    for (const e of new Set(Object.values(ALLOWED_MIME))) {
      const p = path.join(userDir, `${vehicle.id}.${e}`)
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }

    // Filename derives from the validated vehicle id + MIME-derived extension.
    // The vehicle id is a UUID we issued, so this can't escape userDir.
    const filename = `${vehicle.id}.${ext}`
    const fullPath = path.join(userDir, filename)
    // Defense-in-depth: confirm the resolved path is still under userDir.
    const resolved = path.resolve(fullPath)
    if (!resolved.startsWith(path.resolve(userDir) + path.sep)) {
      throw badRequest('Invalid upload path')
    }
    fs.writeFileSync(fullPath, req.file.buffer)

    // Public-ish path served by /uploads/* (auth-gated)
    const photoUrl = `/uploads/${req.user!.id}/${filename}`

    const now = nowIso()
    getDb()
      .prepare(`UPDATE vehicles SET photo_url = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(photoUrl, now, vehicle.id, req.user!.id)

    const row = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicle.id) as Parameters<
      typeof mapVehicle
    >[0]
    res.status(201).json(mapVehicle(row))
  })
)

router.delete(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const vehicle = findOwnedOrThrow<Parameters<typeof mapVehicle>[0]>(
      'vehicles',
      req.params.id,
      req.user!.id
    )
    if (vehicle.photo_url) {
      const expectedPrefix = `/uploads/${req.user!.id}/`
      if (vehicle.photo_url.startsWith(expectedPrefix)) {
        const filename = path.basename(vehicle.photo_url.slice(expectedPrefix.length))
        const fullPath = path.join(config.uploadsDir, req.user!.id, filename)
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath)
          } catch {
            // ignore
          }
        }
      }
    }
    const now = nowIso()
    getDb()
      .prepare(`UPDATE vehicles SET photo_url = NULL, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(now, vehicle.id, req.user!.id)
    const row = getDb().prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicle.id) as Parameters<
      typeof mapVehicle
    >[0]
    res.json(mapVehicle(row))
  })
)

export default router
// Re-exported helper so other route modules can verify vehicle ownership
export const assertOwnsVehicle = (vehicleId: string, userId: string): void => {
  const row = getDb()
    .prepare(`SELECT id, user_id FROM vehicles WHERE id = ?`)
    .get(vehicleId) as { id: string; user_id: string } | undefined
  if (!row || row.user_id !== userId) throw notFound()
}
