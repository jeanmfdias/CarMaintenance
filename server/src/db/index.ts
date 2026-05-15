import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config.js'

let dbInstance: Database.Database | null = null

function applyPragmas(db: Database.Database, isMemory: boolean): void {
  if (!isMemory) {
    db.pragma('journal_mode = WAL')
    // NORMAL is the standard recommendation under WAL — durable across crashes,
    // not durable across power loss, but much faster.
    db.pragma('synchronous = NORMAL')
  }
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance
  const dbPath = config.databasePath
  const isMemory = dbPath === ':memory:'
  if (!isMemory) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new Database(dbPath)
  applyPragmas(db, isMemory)
  dbInstance = db
  return db
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

/**
 * Best-effort cleanup of stale auth state. Runs at boot so the tables
 * don't grow unbounded. Deletes:
 *   - magic_link_tokens past their expires_at OR consumed >24h ago
 *   - auth_sessions past their expires_at
 * Cheap enough to run synchronously.
 */
export function cleanupAuthState(): { tokens: number; sessions: number } {
  const db = getDb()
  const now = new Date().toISOString()
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const tokens = db
    .prepare(`DELETE FROM magic_link_tokens WHERE expires_at < ? OR (consumed_at IS NOT NULL AND consumed_at < ?)`)
    .run(now, dayAgo).changes
  const sessions = db
    .prepare(`DELETE FROM auth_sessions WHERE expires_at < ?`)
    .run(now).changes
  return { tokens, sessions }
}

/** Test-only: replace the DB with a fresh in-memory one. */
export function _resetDbForTests(): Database.Database {
  if (dbInstance) {
    try {
      dbInstance.close()
    } catch {
      // ignore
    }
    dbInstance = null
  }
  const db = new Database(':memory:')
  applyPragmas(db, true)
  dbInstance = db
  return db
}
