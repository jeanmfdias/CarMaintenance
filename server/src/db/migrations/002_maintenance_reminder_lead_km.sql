ALTER TABLE maintenance_records
  ADD COLUMN reminder_lead_km INTEGER NOT NULL DEFAULT 1000;
