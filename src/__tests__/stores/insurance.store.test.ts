import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInsuranceStore } from '@/stores/insurance.store'
import { useAuthStore } from '@/stores/auth.store'
import type { InsurancePolicy } from '@/types'

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
  useAuthStore().user = { id: 'u1' } as any
})

describe('insurance.store — fetchByVehicle', () => {
  it('sets policies from supabase', async () => {
    const data = [makePolicy({ id: 'p1' }), makePolicy({ id: 'p2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useInsuranceStore()
    await store.fetchByVehicle('v1')
    expect(store.policies).toEqual(data)
  })

  it('sets error on failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useInsuranceStore()
    await store.fetchByVehicle('v1')
    expect(store.error).toBe('DB error')
  })
})

describe('insurance.store — create', () => {
  it('adds policy and sorts by expiry_date ascending', async () => {
    const store = useInsuranceStore()
    store.policies = [makePolicy({ id: 'p1', expiry_date: '2026-01-01' })]
    const created = makePolicy({ id: 'p2', expiry_date: '2025-06-01' })
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: created, error: null }) as any)
    await store.create({ vehicle_id: 'v1', insurer: 'Bradesco', policy_number: null, start_date: '2024-06-01', expiry_date: '2025-06-01', annual_cost: null, notes: null, reminder_lead_days: 30 })
    // p2 expires sooner → should be first
    expect(store.policies[0]!.id).toBe('p2')
    expect(store.policies[1]!.id).toBe('p1')
  })
})

describe('insurance.store — update', () => {
  it('updates the policy at the correct index', async () => {
    const policy = makePolicy({ id: 'p1', annual_cost: 3000 })
    const updated = makePolicy({ id: 'p1', annual_cost: 4000 })
    const store = useInsuranceStore()
    store.policies = [policy]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: updated, error: null }) as any)
    await store.update('p1', { annual_cost: 4000 })
    expect(store.policies[0]!.annual_cost).toBe(4000)
  })
})

describe('insurance.store — remove', () => {
  it('removes the policy by id', async () => {
    const store = useInsuranceStore()
    store.policies = [makePolicy({ id: 'p1' }), makePolicy({ id: 'p2' })]
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    await store.remove('p1')
    expect(store.policies).toHaveLength(1)
    expect(store.policies[0]!.id).toBe('p2')
  })
})
