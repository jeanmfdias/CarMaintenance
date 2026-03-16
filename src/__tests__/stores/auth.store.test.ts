import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

import { supabase } from '@/lib/supabase'

function mockFetch(reachable: boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() =>
      reachable
        ? Promise.resolve({ ok: true } as Response)
        : Promise.reject(new TypeError('Failed to fetch')),
    ),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('auth.store — init', () => {
  it('sets serviceUnavailable when Supabase is unreachable', async () => {
    mockFetch(false)
    const store = useAuthStore()
    await store.init()
    expect(store.serviceUnavailable).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('does not call getSession when unreachable', async () => {
    mockFetch(false)
    const store = useAuthStore()
    await store.init()
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
  })

  it('sets user to null when session is absent', async () => {
    mockFetch(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    const store = useAuthStore()
    await store.init()
    expect(store.user).toBeNull()
    expect(store.serviceUnavailable).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('sets user when session is present', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com' }
    mockFetch(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: fakeUser } },
      error: null,
    } as any)
    const store = useAuthStore()
    await store.init()
    expect(store.user).toEqual(fakeUser)
    expect(store.isAuthenticated).toBe(true)
  })
})

describe('auth.store — sendMagicLink', () => {
  it('calls signInWithOtp with the email', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as any)
    const store = useAuthStore()
    await store.sendMagicLink('user@example.com')
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    )
  })

  it('throws when supabase returns an error', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
      data: {},
      error: new Error('Rate limited'),
    } as any)
    const store = useAuthStore()
    await expect(store.sendMagicLink('user@example.com')).rejects.toThrow('Rate limited')
  })
})

describe('auth.store — signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any)
    const store = useAuthStore()
    await store.signOut()
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('throws when supabase returns an error', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: new Error('Sign out failed'),
    } as any)
    const store = useAuthStore()
    await expect(store.signOut()).rejects.toThrow('Sign out failed')
  })
})

describe('auth.store — retryConnection', () => {
  it('resets serviceUnavailable and re-runs init', async () => {
    mockFetch(false)
    const store = useAuthStore()
    await store.init()
    expect(store.serviceUnavailable).toBe(true)

    // Now fix the network and retry
    mockFetch(true)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    await store.retryConnection()
    expect(store.serviceUnavailable).toBe(false)
  })
})
