import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOdometerStore } from '@/stores/odometer.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import type { OdometerEntry } from '@/types'

vi.mock('@/lib/api', () => ({
  api: {
    odometer: {
      listByVehicle: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

function makeEntry(overrides: Partial<OdometerEntry> = {}): OdometerEntry {
  return {
    id: 'e1',
    vehicle_id: 'v1',
    user_id: 'u1',
    reading_km: 50000,
    reading_date: '2024-01-01',
    notes: null,
    created_at: '2024-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('odometer.store — fetchByVehicle', () => {
  it('sets entries from the API', async () => {
    const data = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    vi.mocked(api.odometer.listByVehicle).mockResolvedValue(data)
    const store = useOdometerStore()
    await store.fetchByVehicle('v1')
    expect(store.entries).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error and rethrows on failure', async () => {
    vi.mocked(api.odometer.listByVehicle).mockRejectedValue(new Error('DB error'))
    const store = useOdometerStore()
    await expect(store.fetchByVehicle('v1')).rejects.toThrow('DB error')
    expect(store.error).toBe('DB error')
  })
})

describe('odometer.store — create', () => {
  it('prepends the new entry', async () => {
    const existing = makeEntry({ id: 'e1', reading_km: 50000 })
    const created = makeEntry({ id: 'e2', reading_km: 55000 })
    const store = useOdometerStore()
    store.entries = [existing]
    vi.mocked(api.odometer.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 45000 } as never]
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await store.create({
      vehicle_id: 'v1',
      reading_km: 55000,
      reading_date: '2024-06-01',
      notes: null,
    })
    expect(store.entries[0]).toEqual(created)
    expect(store.entries[1]).toEqual(existing)
  })

  it('calls syncOdometer with vehicle_id and reading_km', async () => {
    const created = makeEntry({ id: 'e2', reading_km: 60000 })
    vi.mocked(api.odometer.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await useOdometerStore().create({
      vehicle_id: 'v1',
      reading_km: 60000,
      reading_date: '2024-06-01',
      notes: null,
    })
    expect(syncSpy).toHaveBeenCalledWith('v1', 60000)
  })

  it('strips vehicle_id from the body sent to the API', async () => {
    const created = makeEntry({ id: 'e2', reading_km: 60000 })
    vi.mocked(api.odometer.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await useOdometerStore().create({
      vehicle_id: 'v1',
      reading_km: 60000,
      reading_date: '2024-06-01',
      notes: null,
    })
    expect(api.odometer.create).toHaveBeenCalledWith('v1', {
      reading_km: 60000,
      reading_date: '2024-06-01',
      notes: null,
    })
  })
})

describe('odometer.store — remove', () => {
  it('removes the entry by id', async () => {
    const store = useOdometerStore()
    store.entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', reading_km: 60000 })]
    vi.mocked(api.odometer.remove).mockResolvedValue(undefined)
    await store.remove('e1')
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.id).toBe('e2')
  })
})
