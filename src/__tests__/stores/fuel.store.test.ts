import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFuelStore } from '@/stores/fuel.store'
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
    await store.update('f2', { odometer_km: 300 })
    expect(store.fillups[0]!.odometer_km).toBe(300)
    expect(store.fillups[1]!.odometer_km).toBe(500)
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
