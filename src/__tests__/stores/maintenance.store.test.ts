import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useOdometerStore } from '@/stores/odometer.store'
import type { MaintenanceRecord } from '@/types'

vi.mock('@/lib/api', () => ({
  api: {
    maintenance: {
      listByVehicle: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

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
    reminder_lead_km: 1000,
    reminder_sent: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('maintenance.store — fetchByVehicle', () => {
  it('sets records from the API', async () => {
    const data = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })]
    vi.mocked(api.maintenance.listByVehicle).mockResolvedValue(data)
    const store = useMaintenanceStore()
    await store.fetchByVehicle('v1')
    expect(store.records).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error and rethrows on failure', async () => {
    vi.mocked(api.maintenance.listByVehicle).mockRejectedValue(new Error('DB error'))
    const store = useMaintenanceStore()
    await expect(store.fetchByVehicle('v1')).rejects.toThrow('DB error')
    expect(store.error).toBe('DB error')
  })
})

describe('maintenance.store — create', () => {
  it('prepends the new record', async () => {
    const existing = makeRecord({ id: 'r1' })
    const created = makeRecord({ id: 'r2', category: 'tire_service', odometer_km: null })
    const store = useMaintenanceStore()
    store.records = [existing]
    vi.mocked(api.maintenance.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await store.create({
      vehicle_id: 'v1',
      category: 'tire_service',
      record_date: '2024-02-01',
      total_cost: 200,
      odometer_km: null,
      labor_cost: null,
      parts_cost: null,
      notes: null,
      next_service_date: null,
      next_service_km: null,
      reminder_lead_days: 30,
      reminder_lead_km: 1000,
      service_provider_id: null,
    })
    expect(store.records[0]).toEqual(created)
    expect(store.records[1]).toEqual(existing)
  })

  it('calls syncOdometer with vehicle_id and odometer_km', async () => {
    const created = makeRecord({ id: 'r2', odometer_km: 20000 })
    vi.mocked(api.maintenance.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as never)
    await useMaintenanceStore().create({
      vehicle_id: 'v1',
      category: 'oil_change',
      record_date: '2024-02-01',
      total_cost: 150,
      odometer_km: 20000,
      labor_cost: null,
      parts_cost: null,
      notes: null,
      next_service_date: null,
      next_service_km: null,
      reminder_lead_days: 30,
      reminder_lead_km: 1000,
      service_provider_id: null,
    })
    expect(syncSpy).toHaveBeenCalledWith('v1', 20000)
  })

  it('does NOT create a client-side odometer entry (backend mirrors it)', async () => {
    const created = makeRecord({ id: 'r1', odometer_km: 15000, record_date: '2024-03-01', vehicle_id: 'v1' })
    vi.mocked(api.maintenance.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const odometerStore = useOdometerStore()
    const createSpy = vi.spyOn(odometerStore, 'create').mockResolvedValue({} as never)
    await useMaintenanceStore().create({
      vehicle_id: 'v1',
      category: 'oil_change',
      record_date: '2024-03-01',
      total_cost: 100,
      odometer_km: 15000,
      labor_cost: null,
      parts_cost: null,
      notes: null,
      next_service_date: null,
      next_service_km: null,
      reminder_lead_days: 30,
      reminder_lead_km: 1000,
      service_provider_id: null,
    })
    // The backend now mirrors odometer entries server-side; the client must
    // not create a duplicate or the entry will be double-counted.
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('refetches odometer entries when the odometer store already has rows for the vehicle', async () => {
    const created = makeRecord({ id: 'r1', odometer_km: 15000, record_date: '2024-03-01', vehicle_id: 'v1' })
    vi.mocked(api.maintenance.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const odometerStore = useOdometerStore()
    // Preload an entry so the refetch heuristic fires
    odometerStore.entries = [
      // minimal shape — only vehicle_id is read by the heuristic
      { id: 'e0', vehicle_id: 'v1' } as never,
    ]
    const fetchSpy = vi.spyOn(odometerStore, 'fetchByVehicle').mockResolvedValue()
    await useMaintenanceStore().create({
      vehicle_id: 'v1',
      category: 'oil_change',
      record_date: '2024-03-01',
      total_cost: 100,
      odometer_km: 15000,
      labor_cost: null,
      parts_cost: null,
      notes: null,
      next_service_date: null,
      next_service_km: null,
      reminder_lead_days: 30,
      reminder_lead_km: 1000,
      service_provider_id: null,
    })
    expect(fetchSpy).toHaveBeenCalledWith('v1')
  })

  it('throws on error', async () => {
    vi.mocked(api.maintenance.create).mockRejectedValue(new Error('Insert failed'))
    const store = useMaintenanceStore()
    await expect(store.create({ vehicle_id: 'v1' } as never)).rejects.toThrow('Insert failed')
  })
})

describe('maintenance.store — update', () => {
  it('updates the record at the correct index', async () => {
    const record = makeRecord({ id: 'r1', total_cost: 100 })
    const updated = makeRecord({ id: 'r1', total_cost: 200 })
    const store = useMaintenanceStore()
    store.records = [record]
    vi.mocked(api.maintenance.update).mockResolvedValue(updated)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await store.update('r1', { total_cost: 200 })
    expect(store.records[0]!.total_cost).toBe(200)
  })

  it('calls syncOdometer when odometer_km is in payload', async () => {
    const updated = makeRecord({ id: 'r1', odometer_km: 15000 })
    vi.mocked(api.maintenance.update).mockResolvedValue(updated)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const store = useMaintenanceStore()
    store.records = [makeRecord({ id: 'r1' })]
    await store.update('r1', { odometer_km: 15000 })
    expect(syncSpy).toHaveBeenCalledWith('v1', 15000)
  })

  it('does not call syncOdometer when odometer_km not in payload', async () => {
    const updated = makeRecord({ id: 'r1', notes: 'new note' })
    vi.mocked(api.maintenance.update).mockResolvedValue(updated)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const store = useMaintenanceStore()
    store.records = [makeRecord({ id: 'r1' })]
    await store.update('r1', { notes: 'new note' })
    expect(syncSpy).not.toHaveBeenCalled()
  })
})

describe('maintenance.store — remove', () => {
  it('removes the record by id', async () => {
    const store = useMaintenanceStore()
    store.records = [makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })]
    vi.mocked(api.maintenance.remove).mockResolvedValue(undefined)
    await store.remove('r1')
    expect(store.records).toHaveLength(1)
    expect(store.records[0]!.id).toBe('r2')
  })
})
