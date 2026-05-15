import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/index.js'

/**
 * Server-side rule: any record that carries an odometer reading should:
 *   1. Push vehicle.current_odometer upward if the new reading is higher.
 *   2. Create a mirror entry in odometer_entries, deduplicated against any
 *      existing entry on the same (vehicle, reading_date, reading_km).
 *
 * Implemented as a single transaction so the three writes (vehicles, odometer,
 * the original record's insert by the caller) are consistent within the
 * caller's enclosing transaction or, if there isn't one, atomic on their own.
 *
 * The original record's insert is NOT part of this helper — callers do that
 * themselves and then call us. We keep the contract narrow on purpose.
 *
 * Returns true if a mirror entry was created, false if it was deduped or
 * no work was needed.
 */
export function syncOdometerOnRecord(opts: {
  userId: string
  vehicleId: string
  reading_km: number | null | undefined
  reading_date: string
  notes?: string | null
}): { mirrored: boolean } {
  if (opts.reading_km == null || !Number.isFinite(opts.reading_km)) {
    return { mirrored: false }
  }
  const db = getDb()
  const now = new Date().toISOString()

  const tx = db.transaction(() => {
    // 1. Bump vehicle.current_odometer if higher.
    db.prepare(
      `UPDATE vehicles SET current_odometer = ?, updated_at = ?
       WHERE id = ? AND user_id = ? AND current_odometer < ?`
    ).run(opts.reading_km, now, opts.vehicleId, opts.userId, opts.reading_km)

    // 2. Dedup against any existing odometer entry at the same date+km.
    const dup = db
      .prepare(
        `SELECT id FROM odometer_entries
         WHERE vehicle_id = ? AND user_id = ? AND reading_date = ? AND reading_km = ?
         LIMIT 1`
      )
      .get(opts.vehicleId, opts.userId, opts.reading_date, opts.reading_km) as
      | { id: string }
      | undefined
    if (dup) return false

    db.prepare(
      `INSERT INTO odometer_entries (id, vehicle_id, user_id, reading_km, reading_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuidv4(),
      opts.vehicleId,
      opts.userId,
      opts.reading_km,
      opts.reading_date,
      opts.notes ?? null,
      now
    )
    return true
  })

  const mirrored = tx() as boolean
  return { mirrored }
}
