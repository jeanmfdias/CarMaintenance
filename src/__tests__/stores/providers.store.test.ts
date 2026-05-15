import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProvidersStore } from '@/stores/providers.store'
import type { ServiceProvider } from '@/types'

vi.mock('@/lib/api', () => ({
  api: {
    providers: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

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
})

describe('providers.store — fetchAll', () => {
  it('sets providers from the API', async () => {
    const data = [makeProvider({ id: 'sp1' }), makeProvider({ id: 'sp2', name: 'Best Mechanic' })]
    vi.mocked(api.providers.list).mockResolvedValue(data)
    const store = useProvidersStore()
    await store.fetchAll()
    expect(store.providers).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('sets error and rethrows on failure', async () => {
    vi.mocked(api.providers.list).mockRejectedValue(new Error('DB error'))
    const store = useProvidersStore()
    await expect(store.fetchAll()).rejects.toThrow('DB error')
    expect(store.error).toBe('DB error')
  })
})

describe('providers.store — create', () => {
  it('adds and sorts providers alphabetically by name', async () => {
    const store = useProvidersStore()
    store.providers = [makeProvider({ id: 'sp2', name: 'Zeta Garage' })]
    const created = makeProvider({ id: 'sp1', name: 'Alpha Auto' })
    vi.mocked(api.providers.create).mockResolvedValue(created)
    await store.create({
      name: 'Alpha Auto',
      address: null,
      phone: null,
      email: null,
      website: null,
      notes: null,
    })
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
    vi.mocked(api.providers.update).mockResolvedValue(updated)
    await store.update('sp1', { name: 'New Name' })
    expect(store.providers[0]!.name).toBe('New Name')
  })
})

describe('providers.store — remove', () => {
  it('removes the provider by id', async () => {
    const store = useProvidersStore()
    store.providers = [makeProvider({ id: 'sp1' }), makeProvider({ id: 'sp2', name: 'Other' })]
    vi.mocked(api.providers.remove).mockResolvedValue(undefined)
    await store.remove('sp1')
    expect(store.providers).toHaveLength(1)
    expect(store.providers[0]!.id).toBe('sp2')
  })
})
