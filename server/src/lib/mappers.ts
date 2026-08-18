/**
 * SQLite stores booleans as INTEGER (0/1).
 * Helpers to convert at the DB boundary.
 */

export const toBoolInt = (v: boolean | undefined | null, fallback = false): number => {
  if (v === undefined || v === null) return fallback ? 1 : 0
  return v ? 1 : 0
}

export const fromBoolInt = (v: unknown): boolean => Number(v) === 1

type RawVehicle = {
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
  current_odometer: number
  notes: string | null
  created_at: string
  updated_at: string
}
export const mapVehicle = (r: RawVehicle) => r

type RawOdo = {
  id: string
  vehicle_id: string
  user_id: string
  reading_km: number
  reading_date: string
  notes: string | null
  created_at: string
}
export const mapOdometer = (r: RawOdo) => r

type RawProvider = {
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
export const mapProvider = (r: RawProvider) => r

type RawMaint = {
  id: string
  vehicle_id: string
  user_id: string
  service_provider_id: string | null
  category: string
  record_date: string
  odometer_km: number | null
  total_cost: number
  labor_cost: number | null
  parts_cost: number | null
  notes: string | null
  next_service_date: string | null
  next_service_km: number | null
  reminder_lead_days: number
  reminder_lead_km: number
  reminder_sent: number
  created_at: string
  updated_at: string
}
export const mapMaintenance = (r: RawMaint) => ({
  ...r,
  reminder_sent: fromBoolInt(r.reminder_sent),
})

type RawFuel = {
  id: string
  vehicle_id: string
  user_id: string
  fillup_date: string
  odometer_km: number
  liters: number
  total_cost: number
  fuel_type: string | null
  full_tank: number
  notes: string | null
  created_at: string
  updated_at: string
}
export const mapFuel = (r: RawFuel) => ({
  ...r,
  full_tank: fromBoolInt(r.full_tank),
  price_per_liter: r.liters > 0 ? Number((r.total_cost / r.liters).toFixed(4)) : 0,
})

type RawInsurance = {
  id: string
  vehicle_id: string
  user_id: string
  insurer: string
  policy_number: string | null
  start_date: string
  expiry_date: string
  annual_cost: number | null
  notes: string | null
  reminder_lead_days: number
  reminder_sent: number
  created_at: string
  updated_at: string
}
export const mapInsurance = (r: RawInsurance) => ({
  ...r,
  reminder_sent: fromBoolInt(r.reminder_sent),
})

type RawSettings = {
  user_id: string
  locale: string
  default_reminder_lead_days: number
  created_at: string
  updated_at: string
}
export const mapSettings = (r: RawSettings) => r
