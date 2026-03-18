import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useAuthStore } from '@/stores/auth.store'
import type { Vehicle } from '@/types'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabase } from '@/lib/supabase'

function makeQueryBuilder(result: { data?: any; error?: any }) {
  const b: any = {}
  const chain = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'limit']
  chain.forEach((m) => { b[m] = vi.fn().mockReturnValue(b) })
  b.single = vi.fn().mockResolvedValue(result)
  b.maybeSingle = vi.fn().mockResolvedValue(result)
  b.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return b
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v1',
    user_id: 'u1',
    make: 'Toyota',
    model: 'Corolla',
    manufacture_year: 2020,
    model_year: 2020,
    purchase_date: '2020-01-01',
    sell_date: null,
    fuel_type: 'gasoline',
    photo_url: null,
    current_odometer: 50000,
    notes: null,
    created_at: '2020-01-01',
    updated_at: '2020-01-01',
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  // Set up a logged-in user
  const auth = useAuthStore()
  auth.user = { id: 'u1' } as any
})

describe('vehicles.store — fetchAll', () => {
  it('sets vehicles from supabase response', async () => {
    const data = [makeVehicle({ id: 'v1' }), makeVehicle({ id: 'v2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useVehiclesStore()
    await store.fetchAll()
    expect(store.vehicles).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets loading to true then false', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: [], error: null }) as any)
    const store = useVehiclesStore()
    const promise = store.fetchAll()
    expect(store.loading).toBe(true)
    await promise
    expect(store.loading).toBe(false)
  })

  it('sets error message on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useVehiclesStore()
    await store.fetchAll()
    expect(store.error).toBe('DB error')
    expect(store.vehicles).toEqual([])
  })
})

describe('vehicles.store — computed', () => {
  it('activeVehicles filters vehicles without sell_date', () => {
    const store = useVehiclesStore()
    store.vehicles = [
      makeVehicle({ id: 'v1', sell_date: null }),
      makeVehicle({ id: 'v2', sell_date: '2023-01-01' }),
      makeVehicle({ id: 'v3', sell_date: null }),
    ]
    expect(store.activeVehicles).toHaveLength(2)
    expect(store.activeVehicles.map((v) => v.id)).toEqual(['v1', 'v3'])
  })

  it('archivedVehicles filters vehicles with sell_date', () => {
    const store = useVehiclesStore()
    store.vehicles = [
      makeVehicle({ id: 'v1', sell_date: null }),
      makeVehicle({ id: 'v2', sell_date: '2023-01-01' }),
    ]
    expect(store.archivedVehicles).toHaveLength(1)
    expect(store.archivedVehicles[0]!.id).toBe('v2')
  })
})

describe('vehicles.store — create', () => {
  it('prepends the new vehicle to the list', async () => {
    const existing = makeVehicle({ id: 'v1' })
    const created = makeVehicle({ id: 'v2', make: 'Honda' })
    const store = useVehiclesStore()
    store.vehicles = [existing]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ make: 'Honda', model: 'Civic', manufacture_year: 2021, model_year: 2021, fuel_type: 'gasoline', current_odometer: 0, purchase_date: null, sell_date: null, photo_url: null, notes: null })
    expect(store.vehicles[0]).toEqual(created)
    expect(store.vehicles[1]).toEqual(existing)
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('Insert failed') }) as any,
    )
    const store = useVehiclesStore()
    await expect(store.create({} as any)).rejects.toThrow('Insert failed')
  })
})

describe('vehicles.store — update', () => {
  it('updates the vehicle at the correct index', async () => {
    const v1 = makeVehicle({ id: 'v1', make: 'Toyota' })
    const updated = makeVehicle({ id: 'v1', make: 'Lexus' })
    const store = useVehiclesStore()
    store.vehicles = [v1]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    await store.update('v1', { make: 'Lexus' })
    expect(store.vehicles[0]!.make).toBe('Lexus')
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('Update failed') }) as any,
    )
    const store = useVehiclesStore()
    await expect(store.update('v1', {})).rejects.toThrow('Update failed')
  })
})

describe('vehicles.store — remove', () => {
  it('removes the vehicle by id', async () => {
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1' }), makeVehicle({ id: 'v2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('v1')
    expect(store.vehicles).toHaveLength(1)
    expect(store.vehicles[0]!.id).toBe('v2')
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('Delete failed') }) as any,
    )
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1' })]
    await expect(store.remove('v1')).rejects.toThrow('Delete failed')
  })
})

describe('vehicles.store — archive', () => {
  it('calls update with the sell_date', async () => {
    const updated = makeVehicle({ id: 'v1', sell_date: '2024-06-01' })
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const result = await store.archive('v1', '2024-06-01')
    expect(result.sell_date).toBe('2024-06-01')
  })
})

describe('vehicles.store — syncOdometer', () => {
  it('updates current_odometer when km is higher', async () => {
    const updated = makeVehicle({ id: 'v1', current_odometer: 60000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1', current_odometer: 50000 })]
    await store.syncOdometer('v1', 60000)
    expect(store.vehicles[0]!.current_odometer).toBe(60000)
  })

  it('does not change odometer when km equals current_odometer', async () => {
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1', current_odometer: 50000 })]
    await store.syncOdometer('v1', 50000)
    expect(store.vehicles[0]!.current_odometer).toBe(50000)
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled()
  })

  it('does not change odometer when km is lower than current_odometer', async () => {
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1', current_odometer: 50000 })]
    await store.syncOdometer('v1', 40000)
    expect(store.vehicles[0]!.current_odometer).toBe(50000)
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled()
  })

  it('does nothing when km is null', async () => {
    const store = useVehiclesStore()
    store.vehicles = [makeVehicle({ id: 'v1', current_odometer: 50000 })]
    await store.syncOdometer('v1', null)
    expect(store.vehicles[0]!.current_odometer).toBe(50000)
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled()
  })

  it('does nothing when vehicle is not in store', async () => {
    const store = useVehiclesStore()
    store.vehicles = []
    await store.syncOdometer('v1', 60000)
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalled()
  })
})
