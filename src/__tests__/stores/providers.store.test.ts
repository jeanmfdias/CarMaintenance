import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProvidersStore } from '@/stores/providers.store'
import { useAuthStore } from '@/stores/auth.store'
import type { ServiceProvider } from '@/types'

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

function makeProvider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
  return {
    id: 'sp1',
    user_id: 'u1',
    name: 'Auto Shop',
    address: null,
    phone: null,
    email: null,
    website: null,
    notes: null,
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

describe('providers.store — fetchAll', () => {
  it('sets providers from supabase', async () => {
    const data = [makeProvider({ id: 'sp1' }), makeProvider({ id: 'sp2', name: 'Best Mechanic' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useProvidersStore()
    await store.fetchAll()
    expect(store.providers).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useProvidersStore()
    await store.fetchAll()
    expect(store.error).toBe('DB error')
  })
})

describe('providers.store — create', () => {
  it('adds and sorts providers alphabetically by name', async () => {
    const store = useProvidersStore()
    store.providers = [makeProvider({ id: 'sp2', name: 'Zeta Garage' })]
    const created = makeProvider({ id: 'sp1', name: 'Alpha Auto' })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ name: 'Alpha Auto', address: null, phone: null, email: null, website: null, notes: null })
    expect(store.providers[0]!.name).toBe('Alpha Auto')
    expect(store.providers[1]!.name).toBe('Zeta Garage')
  })
})

describe('providers.store — update', () => {
  it('updates the provider at the correct index', async () => {
    const provider = makeProvider({ id: 'sp1', name: 'Old Name' })
    const updated = makeProvider({ id: 'sp1', name: 'New Name' })
    const store = useProvidersStore()
    store.providers = [provider]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    await store.update('sp1', { name: 'New Name' })
    expect(store.providers[0]!.name).toBe('New Name')
  })
})

describe('providers.store — remove', () => {
  it('removes the provider by id', async () => {
    const store = useProvidersStore()
    store.providers = [makeProvider({ id: 'sp1' }), makeProvider({ id: 'sp2', name: 'Other' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('sp1')
    expect(store.providers).toHaveLength(1)
    expect(store.providers[0]!.id).toBe('sp2')
  })
})
