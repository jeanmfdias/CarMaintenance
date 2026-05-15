import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInsuranceStore } from '@/stores/insurance.store'
import type { InsurancePolicy } from '@/types'

vi.mock('@/lib/api', () => ({
  api: {
    insurance: {
      listByVehicle: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

import { api } from '@/lib/api'

function makePolicy(overrides: Partial<InsurancePolicy> = {}): InsurancePolicy {
  return {
    id: 'p1',
    vehicle_id: 'v1',
    user_id: 'u1',
    insurer: 'Porto Seguro',
    policy_number: '123',
    start_date: '2024-01-01',
    expiry_date: '2025-01-01',
    annual_cost: 3000,
    notes: null,
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
})

describe('insurance.store — fetchByVehicle', () => {
  it('sets policies from the API', async () => {
    const data = [makePolicy({ id: 'p1' }), makePolicy({ id: 'p2' })]
    vi.mocked(api.insurance.listByVehicle).mockResolvedValue(data)
    const store = useInsuranceStore()
    await store.fetchByVehicle('v1')
    expect(store.policies).toEqual(data)
  })

  it('sets error and rethrows on failure', async () => {
    vi.mocked(api.insurance.listByVehicle).mockRejectedValue(new Error('DB error'))
    const store = useInsuranceStore()
    await expect(store.fetchByVehicle('v1')).rejects.toThrow('DB error')
    expect(store.error).toBe('DB error')
  })
})

describe('insurance.store — create', () => {
  it('adds policy and sorts by expiry_date ascending', async () => {
    const store = useInsuranceStore()
    store.policies = [makePolicy({ id: 'p1', expiry_date: '2026-01-01' })]
    const created = makePolicy({ id: 'p2', expiry_date: '2025-06-01' })
    vi.mocked(api.insurance.create).mockResolvedValue(created)
    await store.create({
      vehicle_id: 'v1',
      insurer: 'Bradesco',
      policy_number: null,
      start_date: '2024-06-01',
      expiry_date: '2025-06-01',
      annual_cost: null,
      notes: null,
      reminder_lead_days: 30,
    })
    expect(store.policies[0]!.id).toBe('p2')
    expect(store.policies[1]!.id).toBe('p1')
  })

  it('strips vehicle_id from the body', async () => {
    const created = makePolicy({ id: 'p2' })
    vi.mocked(api.insurance.create).mockResolvedValue(created)
    await useInsuranceStore().create({
      vehicle_id: 'v1',
      insurer: 'Bradesco',
      policy_number: null,
      start_date: '2024-06-01',
      expiry_date: '2025-06-01',
      annual_cost: null,
      notes: null,
      reminder_lead_days: 30,
    })
    expect(api.insurance.create).toHaveBeenCalledWith('v1', {
      insurer: 'Bradesco',
      policy_number: null,
      start_date: '2024-06-01',
      expiry_date: '2025-06-01',
      annual_cost: null,
      notes: null,
      reminder_lead_days: 30,
    })
  })
})

describe('insurance.store — update', () => {
  it('updates the policy at the correct index', async () => {
    const policy = makePolicy({ id: 'p1', annual_cost: 3000 })
    const updated = makePolicy({ id: 'p1', annual_cost: 4000 })
    const store = useInsuranceStore()
    store.policies = [policy]
    vi.mocked(api.insurance.update).mockResolvedValue(updated)
    await store.update('p1', { annual_cost: 4000 })
    expect(store.policies[0]!.annual_cost).toBe(4000)
  })
})

describe('insurance.store — remove', () => {
  it('removes the policy by id', async () => {
    const store = useInsuranceStore()
    store.policies = [makePolicy({ id: 'p1' }), makePolicy({ id: 'p2' })]
    vi.mocked(api.insurance.remove).mockResolvedValue(undefined)
    await store.remove('p1')
    expect(store.policies).toHaveLength(1)
    expect(store.policies[0]!.id).toBe('p2')
  })
})
