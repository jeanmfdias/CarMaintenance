export type FuelType = 'gasoline' | 'diesel' | 'ethanol' | 'flex' | 'electric' | 'hybrid'

export type MaintenanceCategory =
  | 'oil_change'
  | 'tire_service'
  | 'brake_service'
  | 'general_repair'
  | 'scheduled_service'
  | 'taxes_fees'
  | 'insurance'
  | 'labor'
  | 'accessories'
  | 'fuel'
  | 'other'

export interface Vehicle {
  id: string
  user_id: string
  make: string
  model: string
  manufacture_year: number
  model_year: number
  purchase_date: string | null
  sell_date: string | null
  fuel_type: FuelType
  photo_url: string | null
  current_odometer: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type VehicleInsert = Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type VehicleUpdate = Partial<VehicleInsert>

export interface OdometerEntry {
  id: string
  vehicle_id: string
  user_id: string
  reading_km: number
  reading_date: string
  notes: string | null
  created_at: string
}

export interface ServiceProvider {
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

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  user_id: string
  service_provider_id: string | null
  category: MaintenanceCategory
  record_date: string
  odometer_km: number | null
  total_cost: number
  labor_cost: number | null
  parts_cost: number | null
  notes: string | null
  next_service_date: string | null
  next_service_km: number | null
  reminder_lead_days: number
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

export interface FuelFillup {
  id: string
  vehicle_id: string
  user_id: string
  fillup_date: string
  odometer_km: number
  liters: number
  total_cost: number
  fuel_type: FuelType | null
  full_tank: boolean
  notes: string | null
  price_per_liter: number
  created_at: string
  updated_at: string
}

export interface InsurancePolicy {
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
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  locale: 'en' | 'pt-BR'
  default_reminder_lead_days: number
  created_at: string
  updated_at: string
}
