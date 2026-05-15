import { getDb } from '../db/index.js'
import { notFound } from './errors.js'

/**
 * Tables that participate in per-user ownership. Restricted to a closed set
 * so the dynamic table name in `findOwnedOrThrow` can never become an
 * injection vector even if a future caller passes attacker-controlled input.
 */
const OWNED_TABLES = new Set([
  'vehicles',
  'odometer_entries',
  'maintenance_records',
  'fuel_fillups',
  'insurance_policies',
  'service_providers',
] as const)
export type OwnedTable = typeof OWNED_TABLES extends Set<infer T> ? T : never

/**
 * Look up a row by id and assert it belongs to user_id.
 * Returns the row, or throws 404 — without leaking existence to other users.
 */
export function findOwnedOrThrow<T extends { user_id: string }>(
  table: OwnedTable,
  id: string,
  userId: string
): T {
  // Defense-in-depth: refuse if a caller bypasses the type and passes an
  // unknown table name. SQL is built from this string, so the allowlist is
  // mandatory.
  if (!OWNED_TABLES.has(table)) {
    throw new Error(`findOwnedOrThrow: refusing unknown table ${String(table)}`)
  }
  const row = getDb()
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as T | undefined
  if (!row || row.user_id !== userId) throw notFound()
  return row
}
