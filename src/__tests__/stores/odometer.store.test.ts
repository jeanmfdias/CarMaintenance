import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOdometerStore } from '@/stores/odometer.store'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useAuthStore } from '@/stores/auth.store'
import type { OdometerEntry } from '@/types'

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
  useAuthStore().user = { id: 'u1' } as any
})

describe('odometer.store — fetchByVehicle', () => {
  it('sets entries from supabase', async () => {
    const data = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useOdometerStore()
    await store.fetchByVehicle('v1')
    expect(store.entries).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useOdometerStore()
    await store.fetchByVehicle('v1')
    expect(store.error).toBe('DB error')
  })
})

describe('odometer.store — create', () => {
  it('prepends the new entry', async () => {
    const existing = makeEntry({ id: 'e1', reading_km: 50000 })
    const created = makeEntry({ id: 'e2', reading_km: 55000 })
    const store = useOdometerStore()
    store.entries = [existing]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 45000 } as any]
    vi.spyOn(vehiclesStore, 'update').mockResolvedValue({ id: 'v1', current_odometer: 55000 } as any)
    await store.create({ vehicle_id: 'v1', reading_km: 55000, reading_date: '2024-06-01', notes: null })
    expect(store.entries[0]).toEqual(created)
    expect(store.entries[1]).toEqual(existing)
  })

  it('updates vehicle current_odometer when new reading is higher', async () => {
    const created = makeEntry({ id: 'e2', reading_km: 60000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({ id: 'v1', current_odometer: 60000 } as any)
    await useOdometerStore().create({ vehicle_id: 'v1', reading_km: 60000, reading_date: '2024-06-01', notes: null })
    expect(updateSpy).toHaveBeenCalledWith('v1', { current_odometer: 60000 })
  })

  it('does not update vehicle current_odometer when new reading is lower', async () => {
    const created = makeEntry({ id: 'e2', reading_km: 40000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    await useOdometerStore().create({ vehicle_id: 'v1', reading_km: 40000, reading_date: '2024-06-01', notes: null })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('does not update vehicle current_odometer when vehicle is not loaded', async () => {
    const created = makeEntry({ id: 'e2', reading_km: 60000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [] // vehicle not in store
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    await useOdometerStore().create({ vehicle_id: 'v1', reading_km: 60000, reading_date: '2024-06-01', notes: null })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('odometer.store — update', () => {
  it('updates the entry at the correct index', async () => {
    const entry = makeEntry({ id: 'e1', reading_km: 50000 })
    const updated = makeEntry({ id: 'e1', reading_km: 51000 })
    const store = useOdometerStore()
    store.entries = [entry]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    await store.update('e1', { reading_km: 51000 })
    expect(store.entries[0]!.reading_km).toBe(51000)
  })

  it('updates vehicle current_odometer when edited reading is higher', async () => {
    const updated = makeEntry({ id: 'e1', reading_km: 55000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    const store = useOdometerStore()
    store.entries = [makeEntry({ id: 'e1' })]
    await store.update('e1', { reading_km: 55000 })
    expect(updateSpy).toHaveBeenCalledWith('v1', { current_odometer: 55000 })
  })

  it('does not update vehicle current_odometer when edited reading is lower', async () => {
    const updated = makeEntry({ id: 'e1', reading_km: 45000 })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    const store = useOdometerStore()
    store.entries = [makeEntry({ id: 'e1' })]
    await store.update('e1', { reading_km: 45000 })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('does not update vehicle current_odometer when reading_km is not in payload', async () => {
    const updated = makeEntry({ id: 'e1', notes: 'updated note' })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 50000 } as any]
    const updateSpy = vi.spyOn(vehiclesStore, 'update').mockResolvedValue({} as any)
    const store = useOdometerStore()
    store.entries = [makeEntry({ id: 'e1' })]
    await store.update('e1', { notes: 'updated note' })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('odometer.store — remove', () => {
  it('removes the entry by id', async () => {
    const store = useOdometerStore()
    store.entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', reading_km: 60000 })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('e1')
    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.id).toBe('e2')
  })
})
