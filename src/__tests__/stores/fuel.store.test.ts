import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFuelStore } from '@/stores/fuel.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useOdometerStore } from '@/stores/odometer.store'
import type { FuelFillup } from '@/types'

vi.mock('@/lib/api', () => ({
  api: {
    fuel: {
      listByVehicle: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

function makeFillup(overrides: Partial<FuelFillup> = {}): FuelFillup {
  return {
    id: 'f1',
    vehicle_id: 'v1',
    user_id: 'u1',
    fillup_date: '2024-01-01',
    odometer_km: 1000,
    liters: 40,
    total_cost: 200,
    fuel_type: 'gasoline',
    full_tank: true,
    notes: null,
    price_per_liter: 5,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('fuel.store — fetchByVehicle', () => {
  it('sets fillups from the API', async () => {
    const data = [makeFillup({ id: 'f1' }), makeFillup({ id: 'f2', odometer_km: 2000 })]
    vi.mocked(api.fuel.listByVehicle).mockResolvedValue(data)
    const store = useFuelStore()
    await store.fetchByVehicle('v1')
    expect(store.fillups).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error on failure', async () => {
    vi.mocked(api.fuel.listByVehicle).mockRejectedValue(new Error('DB error'))
    const store = useFuelStore()
    await store.fetchByVehicle('v1')
    expect(store.error).toBe('DB error')
  })
})

describe('fuel.store — create (odometer ordering)', () => {
  it('inserts at the end when odometer is highest', async () => {
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1', odometer_km: 500 })]
    const created = makeFillup({ id: 'f2', odometer_km: 1000 })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    await store.create({
      vehicle_id: 'v1',
      fillup_date: '2024-02-01',
      odometer_km: 1000,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(store.fillups[1]).toEqual(created)
  })

  it('inserts in the middle at correct odometer position', async () => {
    const store = useFuelStore()
    store.fillups = [
      makeFillup({ id: 'f1', odometer_km: 500 }),
      makeFillup({ id: 'f3', odometer_km: 1500 }),
    ]
    const created = makeFillup({ id: 'f2', odometer_km: 1000 })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    await store.create({
      vehicle_id: 'v1',
      fillup_date: '2024-02-01',
      odometer_km: 1000,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(store.fillups[1]).toEqual(created)
    expect(store.fillups.map((f) => f.odometer_km)).toEqual([500, 1000, 1500])
  })

  it('inserts at the start when odometer is lowest', async () => {
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f2', odometer_km: 1000 })]
    const created = makeFillup({ id: 'f1', odometer_km: 100 })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    await store.create({
      vehicle_id: 'v1',
      fillup_date: '2024-01-01',
      odometer_km: 100,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(store.fillups[0]).toEqual(created)
  })

  it('calls syncOdometer with vehicle_id and odometer_km', async () => {
    const created = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 12345 })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    await useFuelStore().create({
      vehicle_id: 'v1',
      fillup_date: '2024-02-01',
      odometer_km: 12345,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(syncSpy).toHaveBeenCalledWith('v1', 12345)
  })

  it('does NOT create a client-side odometer entry (backend mirrors it)', async () => {
    const created = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 12345 })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    const odoCreateSpy = vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as never)
    await useFuelStore().create({
      vehicle_id: 'v1',
      fillup_date: '2024-02-01',
      odometer_km: 12345,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(odoCreateSpy).not.toHaveBeenCalled()
  })

  it('strips vehicle_id from the body sent to the API', async () => {
    const created = makeFillup({ id: 'f1', vehicle_id: 'v1' })
    vi.mocked(api.fuel.create).mockResolvedValue(created)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    await useFuelStore().create({
      vehicle_id: 'v1',
      fillup_date: '2024-02-01',
      odometer_km: 1000,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
    expect(api.fuel.create).toHaveBeenCalledWith('v1', {
      fillup_date: '2024-02-01',
      odometer_km: 1000,
      liters: 40,
      total_cost: 200,
      fuel_type: 'gasoline',
      full_tank: true,
      notes: null,
    })
  })
})

describe('fuel.store — update', () => {
  it('updates fillup and re-sorts by odometer', async () => {
    const store = useFuelStore()
    store.fillups = [
      makeFillup({ id: 'f1', odometer_km: 500 }),
      makeFillup({ id: 'f2', odometer_km: 1000 }),
    ]
    const updated = makeFillup({ id: 'f2', odometer_km: 300 })
    vi.mocked(api.fuel.update).mockResolvedValue(updated)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    await store.update('f2', { odometer_km: 300 })
    expect(store.fillups[0]!.odometer_km).toBe(300)
    expect(store.fillups[1]!.odometer_km).toBe(500)
  })

  it('calls syncOdometer when odometer_km is in payload', async () => {
    const updated = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 9000 })
    vi.mocked(api.fuel.update).mockResolvedValue(updated)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' })]
    await store.update('f1', { odometer_km: 9000 })
    expect(syncSpy).toHaveBeenCalledWith('v1', 9000)
  })

  it('does not call syncOdometer when odometer_km is not in payload', async () => {
    const updated = makeFillup({ id: 'f1', total_cost: 999 })
    vi.mocked(api.fuel.update).mockResolvedValue(updated)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' })]
    await store.update('f1', { total_cost: 999 })
    expect(syncSpy).not.toHaveBeenCalled()
  })
})

describe('fuel.store — remove', () => {
  it('removes fillup by id', async () => {
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' }), makeFillup({ id: 'f2', odometer_km: 2000 })]
    vi.mocked(api.fuel.remove).mockResolvedValue(undefined)
    await store.remove('f1')
    expect(store.fillups).toHaveLength(1)
    expect(store.fillups[0]!.id).toBe('f2')
  })
})
