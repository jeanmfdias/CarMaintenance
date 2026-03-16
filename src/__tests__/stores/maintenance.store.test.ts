import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useAuthStore } from '@/stores/auth.store'
import type { MaintenanceRecord } from '@/types'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '@/lib/supabase'

function makeQueryBuilder(result: { data?: any; error?: any }) {
  const b: any = {}
  ;['select', 'insert', 'update', 'delete', 'eq', 'order'].forEach((m) => {
    b[m] = vi.fn().mockReturnValue(b)
  })
  b.single = vi.fn().mockResolvedValue(result)
  b.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return b
}

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'r1',
    vehicle_id: 'v1',
    user_id: 'u1',
    service_provider_id: null,
    category: 'oil_change',
    record_date: '2024-01-01',
    odometer_km: 10000,
    total_cost: 150,
    labor_cost: null,
    parts_cost: null,
    notes: null,
    next_service_date: null,
    next_service_km: null,
    reminder_lead_days: 30,
    reminder_sent: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().user = { id: 'u1' } as any
})

describe('maintenance.store — fetchByVehicle', () => {
  it('sets records from supabase', async () => {
    const data = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useMaintenanceStore()
    await store.fetchByVehicle('v1')
    expect(store.records).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useMaintenanceStore()
    await store.fetchByVehicle('v1')
    expect(store.error).toBe('DB error')
  })
})

describe('maintenance.store — create', () => {
  it('prepends the new record', async () => {
    const existing = makeRecord({ id: 'r1' })
    const created = makeRecord({ id: 'r2', category: 'tire_service' })
    const store = useMaintenanceStore()
    store.records = [existing]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ vehicle_id: 'v1', category: 'tire_service', record_date: '2024-02-01', total_cost: 200, odometer_km: null, labor_cost: null, parts_cost: null, notes: null, next_service_date: null, next_service_km: null, reminder_lead_days: 30, service_provider_id: null })
    expect(store.records[0]).toEqual(created)
    expect(store.records[1]).toEqual(existing)
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('Insert failed') }) as any,
    )
    const store = useMaintenanceStore()
    await expect(store.create({} as any)).rejects.toThrow('Insert failed')
  })
})

describe('maintenance.store — update', () => {
  it('updates the record at the correct index', async () => {
    const record = makeRecord({ id: 'r1', total_cost: 100 })
    const updated = makeRecord({ id: 'r1', total_cost: 200 })
    const store = useMaintenanceStore()
    store.records = [record]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    await store.update('r1', { total_cost: 200 })
    expect(store.records[0]!.total_cost).toBe(200)
  })
})

describe('maintenance.store — remove', () => {
  it('removes the record by id', async () => {
    const store = useMaintenanceStore()
    store.records = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('r1')
    expect(store.records).toHaveLength(1)
    expect(store.records[0]!.id).toBe('r2')
  })
})
