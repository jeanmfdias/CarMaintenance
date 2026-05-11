/**
 * One-shot data migration: Supabase -> SQLite.
 *
 * Reads the existing Supabase project (auth.users + public.* tables) using the
 * service-role key (RLS bypassed) and inserts rows into the local SQLite DB
 * using `INSERT OR IGNORE` so re-runs are idempotent.
 *
 * Usage:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npm run migrate:supabase
 *
 * Optional flags:
 *   --photos   Also download vehicle photo_url files from Supabase Storage
 *              into server/data/uploads/<user_id>/<vehicle_id>.<ext> and
 *              rewrite vehicles.photo_url to the new path.
 *
 * IMPORTANT: This script never touches Supabase magic-link tokens or sessions.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getDb } from '../db/index.js'
import { toBoolInt } from '../lib/mappers.js'

const PAGE_SIZE = 1000
const HAS_PHOTOS_FLAG = process.argv.includes('--photos')

type TableStats = { table: string; inserted: number; skipped: number; total: number }

function fail(message: string): never {
  console.error(`\n[migrate-from-supabase] ERROR: ${message}\n`)
  process.exit(1)
}

function getEnv(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    fail(
      'Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY env vars.\n' +
        'Set them in server/.env (see .env.example) or export them in your shell.\n' +
        'The service-role key is required to bypass RLS during migration.'
    )
  }
  return { url, serviceKey }
}

async function fetchPage<T>(
  client: SupabaseClient,
  table: string,
  from: number,
  to: number
): Promise<T[]> {
  const { data, error } = await client.from(table).select('*').range(from, to)
  if (error) throw new Error(`[${table}] ${error.message}`)
  return (data ?? []) as T[]
}

async function fetchAllRows<T>(
  client: SupabaseClient,
  table: string
): Promise<T[]> {
  const all: T[] = []
  let page = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const rows = await fetchPage<T>(client, table, from, to)
    console.log(`  [${table}] page ${page + 1}: ${rows.length} rows`)
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
    page++
  }
  return all
}

type SupabaseAuthUser = {
  id: string
  email: string | null | undefined
  created_at: string | null | undefined
  updated_at?: string | null | undefined
}

async function fetchAllAuthUsers(client: SupabaseClient): Promise<SupabaseAuthUser[]> {
  const all: SupabaseAuthUser[] = []
  let page = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new Error(`[auth.users] ${error.message}`)
    const rows = (data?.users ?? []) as SupabaseAuthUser[]
    console.log(`  [auth.users] page ${page}: ${rows.length} rows`)
    all.push(...rows)
    if (rows.length < PAGE_SIZE) break
    page++
  }
  return all
}

function migrateUsers(rows: SupabaseAuthUser[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)`
  )
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SupabaseAuthUser[]) => {
    for (const u of items) {
      if (!u.email) {
        console.warn(`  [users] skipping ${u.id}: no email`)
        skipped++
        continue
      }
      const createdAt = u.created_at ?? new Date().toISOString()
      const updatedAt = u.updated_at ?? createdAt
      const result = stmt.run(u.id, u.email, createdAt, updatedAt)
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'users', inserted, skipped, total: rows.length }
}

type SbVehicle = {
  id: string
  user_id: string
  make: string
  model: string
  manufacture_year: number
  model_year: number
  purchase_date: string | null
  sell_date: string | null
  fuel_type: string
  photo_url: string | null
  current_odometer: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

function migrateVehicles(rows: SbVehicle[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO vehicles (
      id, user_id, make, model, manufacture_year, model_year,
      purchase_date, sell_date, fuel_type, photo_url,
      current_odometer, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbVehicle[]) => {
    for (const v of items) {
      const result = stmt.run(
        v.id,
        v.user_id,
        v.make,
        v.model,
        Number(v.manufacture_year),
        Number(v.model_year),
        v.purchase_date,
        v.sell_date,
        v.fuel_type,
        v.photo_url,
        Number(v.current_odometer ?? 0),
        v.notes,
        v.created_at,
        v.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'vehicles', inserted, skipped, total: rows.length }
}

type SbProvider = {
  id: string
  user_id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

function migrateProviders(rows: SbProvider[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO service_providers (
      id, user_id, name, address, phone, email, website, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbProvider[]) => {
    for (const p of items) {
      const result = stmt.run(
        p.id,
        p.user_id,
        p.name,
        p.address,
        p.phone,
        p.email,
        p.website,
        p.notes,
        p.created_at,
        p.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'service_providers', inserted, skipped, total: rows.length }
}

type SbOdo = {
  id: string
  vehicle_id: string
  user_id: string
  reading_km: number
  reading_date: string
  notes: string | null
  created_at: string
}

function migrateOdometer(rows: SbOdo[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO odometer_entries (
      id, vehicle_id, user_id, reading_km, reading_date, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbOdo[]) => {
    for (const o of items) {
      const result = stmt.run(
        o.id,
        o.vehicle_id,
        o.user_id,
        Number(o.reading_km),
        o.reading_date,
        o.notes,
        o.created_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'odometer_entries', inserted, skipped, total: rows.length }
}

type SbMaint = {
  id: string
  vehicle_id: string
  user_id: string
  service_provider_id: string | null
  category: string
  record_date: string
  odometer_km: number | null
  total_cost: number | null
  labor_cost: number | null
  parts_cost: number | null
  notes: string | null
  next_service_date: string | null
  next_service_km: number | null
  reminder_lead_days: number | null
  reminder_sent: boolean | null
  created_at: string
  updated_at: string
}

function migrateMaintenance(rows: SbMaint[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO maintenance_records (
      id, vehicle_id, user_id, service_provider_id, category, record_date,
      odometer_km, total_cost, labor_cost, parts_cost, notes,
      next_service_date, next_service_km, reminder_lead_days, reminder_sent,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbMaint[]) => {
    for (const m of items) {
      const result = stmt.run(
        m.id,
        m.vehicle_id,
        m.user_id,
        m.service_provider_id,
        m.category,
        m.record_date,
        m.odometer_km == null ? null : Number(m.odometer_km),
        Number(m.total_cost ?? 0),
        m.labor_cost == null ? null : Number(m.labor_cost),
        m.parts_cost == null ? null : Number(m.parts_cost),
        m.notes,
        m.next_service_date,
        m.next_service_km == null ? null : Number(m.next_service_km),
        Number(m.reminder_lead_days ?? 30),
        toBoolInt(m.reminder_sent ?? false),
        m.created_at,
        m.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'maintenance_records', inserted, skipped, total: rows.length }
}

type SbFuel = {
  id: string
  vehicle_id: string
  user_id: string
  fillup_date: string
  odometer_km: number
  liters: number
  total_cost: number
  fuel_type: string | null
  full_tank: boolean | null
  notes: string | null
  // price_per_liter intentionally ignored — computed on read
  created_at: string
  updated_at: string
}

function migrateFuel(rows: SbFuel[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO fuel_fillups (
      id, vehicle_id, user_id, fillup_date, odometer_km, liters, total_cost,
      fuel_type, full_tank, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbFuel[]) => {
    for (const f of items) {
      const result = stmt.run(
        f.id,
        f.vehicle_id,
        f.user_id,
        f.fillup_date,
        Number(f.odometer_km),
        Number(f.liters),
        Number(f.total_cost),
        f.fuel_type,
        toBoolInt(f.full_tank ?? true),
        f.notes,
        f.created_at,
        f.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'fuel_fillups', inserted, skipped, total: rows.length }
}

type SbInsurance = {
  id: string
  vehicle_id: string
  user_id: string
  insurer: string
  policy_number: string | null
  start_date: string
  expiry_date: string
  annual_cost: number | null
  notes: string | null
  reminder_lead_days: number | null
  reminder_sent: boolean | null
  created_at: string
  updated_at: string
}

function migrateInsurance(rows: SbInsurance[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO insurance_policies (
      id, vehicle_id, user_id, insurer, policy_number, start_date, expiry_date,
      annual_cost, notes, reminder_lead_days, reminder_sent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbInsurance[]) => {
    for (const i of items) {
      const result = stmt.run(
        i.id,
        i.vehicle_id,
        i.user_id,
        i.insurer,
        i.policy_number,
        i.start_date,
        i.expiry_date,
        i.annual_cost == null ? null : Number(i.annual_cost),
        i.notes,
        Number(i.reminder_lead_days ?? 30),
        toBoolInt(i.reminder_sent ?? false),
        i.created_at,
        i.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'insurance_policies', inserted, skipped, total: rows.length }
}

type SbSettings = {
  user_id: string
  locale: string | null
  default_reminder_lead_days: number | null
  created_at: string
  updated_at: string
}

function migrateSettings(rows: SbSettings[]): TableStats {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO user_settings (
      user_id, locale, default_reminder_lead_days, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `)
  let inserted = 0
  let skipped = 0
  const tx = db.transaction((items: SbSettings[]) => {
    for (const s of items) {
      const result = stmt.run(
        s.user_id,
        s.locale ?? 'en',
        Number(s.default_reminder_lead_days ?? 30),
        s.created_at,
        s.updated_at
      )
      if (result.changes > 0) inserted++
      else skipped++
    }
  })
  tx(rows)
  return { table: 'user_settings', inserted, skipped, total: rows.length }
}

function printSummary(stats: TableStats[]): void {
  console.log('\n=== Migration summary ===')
  for (const s of stats) {
    console.log(
      `  ${s.table.padEnd(22)} inserted=${s.inserted}  skipped=${s.skipped}  total=${s.total}`
    )
  }
}

function printValidation(): void {
  const db = getDb()
  const tables = [
    'users',
    'vehicles',
    'service_providers',
    'odometer_entries',
    'maintenance_records',
    'fuel_fillups',
    'insurance_policies',
    'user_settings',
  ]
  console.log('\n=== Final SQLite row counts ===')
  for (const t of tables) {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get() as { c: number }
    console.log(`  ${t.padEnd(22)} ${row.c}`)
  }
}

async function migratePhotosStub(): Promise<void> {
  // TODO: implement vehicle photo migration from Supabase Storage.
  // Plan when implemented:
  //   1. List vehicles where photo_url is not null.
  //   2. For each, derive bucket + path from photo_url (Supabase public URLs
  //      look like /storage/v1/object/public/<bucket>/<path>).
  //   3. supabaseAdmin.storage.from(bucket).download(path) -> Blob.
  //   4. Write to <uploadsDir>/<user_id>/<vehicle_id>.<ext>.
  //   5. UPDATE vehicles SET photo_url = '/uploads/<user_id>/<vehicle_id>.<ext>'.
  console.warn(
    '\n[--photos] Vehicle photo migration is not implemented in this script.\n' +
      '          Follow-up: download Supabase Storage objects referenced by\n' +
      '          vehicles.photo_url into server/data/uploads/<user_id>/<vehicle_id>.<ext>\n' +
      '          and rewrite photo_url to the local path.\n'
  )
}

async function main(): Promise<void> {
  const { url, serviceKey } = getEnv()
  const client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('[migrate-from-supabase] Starting migration')
  console.log(`  source: ${url}`)
  if (HAS_PHOTOS_FLAG) console.log('  flag:   --photos')

  const stats: TableStats[] = []

  // 1) users (FK target for everything)
  console.log('\n--- auth.users ---')
  const authUsers = await fetchAllAuthUsers(client)
  stats.push(migrateUsers(authUsers))

  // 2) service_providers + vehicles (depend only on users)
  console.log('\n--- service_providers ---')
  const providers = await fetchAllRows<SbProvider>(client, 'service_providers')
  stats.push(migrateProviders(providers))

  console.log('\n--- vehicles ---')
  const vehicles = await fetchAllRows<SbVehicle>(client, 'vehicles')
  stats.push(migrateVehicles(vehicles))

  // 3) child tables of vehicles
  console.log('\n--- odometer_entries ---')
  const odo = await fetchAllRows<SbOdo>(client, 'odometer_entries')
  stats.push(migrateOdometer(odo))

  console.log('\n--- maintenance_records ---')
  const maint = await fetchAllRows<SbMaint>(client, 'maintenance_records')
  stats.push(migrateMaintenance(maint))

  console.log('\n--- fuel_fillups ---')
  const fuel = await fetchAllRows<SbFuel>(client, 'fuel_fillups')
  stats.push(migrateFuel(fuel))

  console.log('\n--- insurance_policies ---')
  const ins = await fetchAllRows<SbInsurance>(client, 'insurance_policies')
  stats.push(migrateInsurance(ins))

  // 4) user_settings (1:1 with users)
  console.log('\n--- user_settings ---')
  const settings = await fetchAllRows<SbSettings>(client, 'user_settings')
  stats.push(migrateSettings(settings))

  // 5) optional photos
  if (HAS_PHOTOS_FLAG) {
    await migratePhotosStub()
  } else {
    console.log(
      '\n[migrate-from-supabase] Skipping vehicle photos (pass --photos to enable; currently a stub).'
    )
  }

  printSummary(stats)
  printValidation()

  console.log('\n[migrate-from-supabase] Done.')
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`\n[migrate-from-supabase] FAILED: ${msg}`)
  if (err instanceof Error && err.stack) console.error(err.stack)
  process.exit(1)
})
