-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Magic-link tokens
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_user ON magic_link_tokens(user_id);

-- Auth sessions (JWTs are stateless; we keep a row per session for revocation/audit)
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacture_year INTEGER NOT NULL,
  model_year INTEGER NOT NULL,
  purchase_date TEXT,
  sell_date TEXT,
  fuel_type TEXT NOT NULL,
  photo_url TEXT,
  current_odometer INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_created ON vehicles(user_id, created_at DESC);

-- Odometer entries
CREATE TABLE IF NOT EXISTS odometer_entries (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reading_km INTEGER NOT NULL,
  reading_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_odo_vehicle ON odometer_entries(vehicle_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_odo_user ON odometer_entries(user_id);

-- Service providers
CREATE TABLE IF NOT EXISTS service_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_providers_user_name ON service_providers(user_id, name);

-- Maintenance records
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  service_provider_id TEXT,
  category TEXT NOT NULL,
  record_date TEXT NOT NULL,
  odometer_km INTEGER,
  total_cost REAL NOT NULL DEFAULT 0,
  labor_cost REAL,
  parts_cost REAL,
  notes TEXT,
  next_service_date TEXT,
  next_service_km INTEGER,
  reminder_lead_days INTEGER NOT NULL DEFAULT 30,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_provider_id) REFERENCES service_providers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_maint_vehicle_date ON maintenance_records(vehicle_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_maint_user ON maintenance_records(user_id);

-- Fuel fillups
CREATE TABLE IF NOT EXISTS fuel_fillups (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  fillup_date TEXT NOT NULL,
  odometer_km INTEGER NOT NULL,
  liters REAL NOT NULL,
  total_cost REAL NOT NULL,
  fuel_type TEXT,
  full_tank INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_odo ON fuel_fillups(vehicle_id, odometer_km ASC);
CREATE INDEX IF NOT EXISTS idx_fuel_user ON fuel_fillups(user_id);

-- Insurance policies
CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  start_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  annual_cost REAL,
  notes TEXT,
  reminder_lead_days INTEGER NOT NULL DEFAULT 30,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ins_vehicle_expiry ON insurance_policies(vehicle_id, expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_ins_user ON insurance_policies(user_id);

-- User settings (1:1 with user)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'en',
  default_reminder_lead_days INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
