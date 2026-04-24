import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFuelStore } from '@/stores/fuel.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useOdometerStore } from '@/stores/odometer.store'
import { useAuthStore } from '@/stores/auth.store'
import type { FuelFillup } from '@/types'

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
  useAuthStore().user = { id: 'u1' } as any
})

describe('fuel.store — fetchByVehicle', () => {
  it('sets fillups from supabase', async () => {
    const data = [makeFillup({ id: 'f1' }), makeFillup({ id: 'f2', odometer_km: 2000 })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useFuelStore()
    await store.fetchByVehicle('v1')
    expect(store.fillups).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
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
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ vehicle_id: 'v1', fillup_date: '2024-02-01', odometer_km: 1000, liters: 40, total_cost: 200, fuel_type: 'gasoline', full_tank: true, notes: null })
    expect(store.fillups[1]).toEqual(created)
  })

  it('inserts in the middle at correct odometer position', async () => {
    const store = useFuelStore()
    store.fillups = [
      makeFillup({ id: 'f1', odometer_km: 500 }),
      makeFillup({ id: 'f3', odometer_km: 1500 }),
    ]
    const created = makeFillup({ id: 'f2', odometer_km: 1000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ vehicle_id: 'v1', fillup_date: '2024-02-01', odometer_km: 1000, liters: 40, total_cost: 200, fuel_type: 'gasoline', full_tank: true, notes: null })
    expect(store.fillups[1]).toEqual(created)
    expect(store.fillups.map((f) => f.odometer_km)).toEqual([500, 1000, 1500])
  })

  it('inserts at the start when odometer is lowest', async () => {
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f2', odometer_km: 1000 })]
    const created = makeFillup({ id: 'f1', odometer_km: 100 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ vehicle_id: 'v1', fillup_date: '2024-01-01', odometer_km: 100, liters: 40, total_cost: 200, fuel_type: 'gasoline', full_tank: true, notes: null })
    expect(store.fillups[0]).toEqual(created)
  })

  it('calls syncOdometer with vehicle_id and odometer_km', async () => {
    const created = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 12345 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as any)
    await useFuelStore().create({ vehicle_id: 'v1', fillup_date: '2024-02-01', odometer_km: 12345, liters: 40, total_cost: 200, fuel_type: 'gasoline', full_tank: true, notes: null })
    expect(syncSpy).toHaveBeenCalledWith('v1', 12345)
  })

  it('creates odometer entry with vehicle_id, odometer_km and fillup_date', async () => {
    const created = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 12345, fillup_date: '2024-03-15' })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const odometerStore = useOdometerStore()
    const createSpy = vi.spyOn(odometerStore, 'create').mockResolvedValue({} as any)
    await useFuelStore().create({ vehicle_id: 'v1', fillup_date: '2024-03-15', odometer_km: 12345, liters: 40, total_cost: 200, fuel_type: 'gasoline', full_tank: true, notes: null })
    expect(createSpy).toHaveBeenCalledWith({ vehicle_id: 'v1', reading_km: 12345, reading_date: '2024-03-15', notes: null })
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
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    vi.spyOn(useVehiclesStore(), 'syncOdometer').mockResolvedValue()
    vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as any)
    await store.update('f2', { odometer_km: 300 })
    expect(store.fillups[0]!.odometer_km).toBe(300)
    expect(store.fillups[1]!.odometer_km).toBe(500)
  })

  it('calls syncOdometer when odometer_km is in payload', async () => {
    const updated = makeFillup({ id: 'f1', vehicle_id: 'v1', odometer_km: 9000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as any)
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' })]
    await store.update('f1', { odometer_km: 9000 })
    expect(syncSpy).toHaveBeenCalledWith('v1', 9000)
  })

  it('does not call syncOdometer when odometer_km is not in payload', async () => {
    const updated = makeFillup({ id: 'f1', total_cost: 999 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
    const createSpy = vi.spyOn(useOdometerStore(), 'create').mockResolvedValue({} as any)
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' })]
    await store.update('f1', { total_cost: 999 })
    expect(syncSpy).not.toHaveBeenCalled()
    expect(createSpy).not.toHaveBeenCalled()
  })
})

describe('fuel.store — remove', () => {
  it('removes fillup by id', async () => {
    const store = useFuelStore()
    store.fillups = [makeFillup({ id: 'f1' }), makeFillup({ id: 'f2', odometer_km: 2000 })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('f1')
    expect(store.fillups).toHaveLength(1)
    expect(store.fillups[0]!.id).toBe('f2')
  })
})
