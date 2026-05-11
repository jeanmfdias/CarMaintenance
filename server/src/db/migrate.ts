import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDb } from './index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function runMigrations(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const migrationsDir = path.join(__dirname, 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    console.log('[migrate] no migrations directory found at', migrationsDir)
    return
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const applied = new Set(
    db
      .prepare(`SELECT filename FROM _migrations`)
      .all()
      .map((r) => (r as { filename: string }).filename)
  )

  const insertApplied = db.prepare(
    `INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)`
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    const tx = db.transaction(() => {
      db.exec(sql)
      insertApplied.run(file, new Date().toISOString())
    })
    tx()
    console.log(`[migrate] applied ${file}`)
  }
}

// Run when invoked directly via `npm run migrate` / `tsx`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
  console.log('[migrate] done')
}
