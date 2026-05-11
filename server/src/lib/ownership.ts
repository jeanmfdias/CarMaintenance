import { getDb } from '../db/index.js'
import { notFound } from './errors.js'

/**
 * Look up a row by id and assert it belongs to user_id.
 * Returns the row, or throws 404 — without leaking existence to other users.
 */
export function findOwnedOrThrow<T extends { user_id: string }>(
  table: string,
  id: string,
  userId: string
): T {
  const row = getDb()
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as T | undefined
  if (!row || row.user_id !== userId) throw notFound()
  return row
}
