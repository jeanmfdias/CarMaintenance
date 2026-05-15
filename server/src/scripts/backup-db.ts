/**
 * Copies the live SQLite database to a timestamped file in BACKUP_DIR.
 *
 * Uses better-sqlite3's `db.backup()` so the copy is consistent even if
 * writers are active (no torn pages from a naive fs.copy).
 *
 * Usage:
 *   npm run db:backup                                  -> ./data/backups/app-<ts>.db
 *   BACKUP_DIR=/var/backups/cm  npm run db:backup      -> /var/backups/cm/app-<ts>.db
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../config.js'

async function main(): Promise<void> {
  const src = config.databasePath
  if (src === ':memory:') {
    console.error('[backup] DATABASE_PATH is :memory: — nothing to back up')
    process.exit(1)
  }
  if (!fs.existsSync(src)) {
    console.error(`[backup] source DB not found: ${src}`)
    process.exit(1)
  }

  const backupDir = path.isAbsolute(process.env.BACKUP_DIR ?? '')
    ? (process.env.BACKUP_DIR as string)
    : path.resolve(process.cwd(), process.env.BACKUP_DIR ?? './data/backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dst = path.join(backupDir, `app-${ts}.db`)

  const db = new Database(src, { readonly: true })
  try {
    await db.backup(dst)
  } finally {
    db.close()
  }
  const bytes = fs.statSync(dst).size
  console.log(`[backup] wrote ${dst} (${(bytes / 1024 / 1024).toFixed(2)} MiB)`)
}

main().catch((err: unknown) => {
  console.error('[backup] failed:', (err as Error).message)
  process.exit(1)
})
