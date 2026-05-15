import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'

// Stash the 401 handler registered by auth.store so tests can trigger it.
let registered401Handler: (() => void) | null = null

vi.mock('@/lib/api', async () => {
  // Keep ApiError as the real class so `instanceof` works in the store.
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    api: {
      auth: {
        sendMagicLink: vi.fn(),
        verify: vi.fn(),
        logout: vi.fn(),
        me: vi.fn(),
      },
      health: vi.fn(),
    },
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    onUnauthorized: vi.fn((handler: (() => void) | null) => {
      registered401Handler = handler
    }),
  }
})

import { api, getToken, setToken, clearToken, ApiError } from '@/lib/api'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  registered401Handler = null
})

describe('auth.store — init', () => {
  it('sets serviceUnavailable when backend is unreachable', async () => {
    vi.mocked(api.health).mockResolvedValue(false)
    const store = useAuthStore()
    await store.init()
    expect(store.serviceUnavailable).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('does not call api.auth.me when unreachable', async () => {
    vi.mocked(api.health).mockResolvedValue(false)
    const store = useAuthStore()
    await store.init()
    expect(api.auth.me).not.toHaveBeenCalled()
  })

  it('sets user to null when no token is stored', async () => {
    vi.mocked(api.health).mockResolvedValue(true)
    vi.mocked(getToken).mockReturnValue(null)
    const store = useAuthStore()
    await store.init()
    expect(store.user).toBeNull()
    expect(store.serviceUnavailable).toBe(false)
    expect(store.loading).toBe(false)
    expect(api.auth.me).not.toHaveBeenCalled()
  })

  it('loads user from /auth/me when a token is present', async () => {
    const fakeUser = { id: 'user-1', email: 'test@example.com' }
    vi.mocked(api.health).mockResolvedValue(true)
    vi.mocked(getToken).mockReturnValue('jwt-token')
    vi.mocked(api.auth.me).mockResolvedValue(fakeUser)
    const store = useAuthStore()
    await store.init()
    expect(store.user).toEqual(fakeUser)
    expect(store.isAuthenticated).toBe(true)
  })

  it('clears user on 401 from /auth/me', async () => {
    vi.mocked(api.health).mockResolvedValue(true)
    vi.mocked(getToken).mockReturnValue('jwt-token')
    vi.mocked(api.auth.me).mockRejectedValue(new ApiError(401, 'unauthorized', 'expired'))
    const store = useAuthStore()
    await store.init()
    expect(store.user).toBeNull()
    expect(store.serviceUnavailable).toBe(false)
  })

  it('marks service unavailable on non-401 errors from /auth/me', async () => {
    vi.mocked(api.health).mockResolvedValue(true)
    vi.mocked(getToken).mockReturnValue('jwt-token')
    vi.mocked(api.auth.me).mockRejectedValue(new ApiError(500, 'server_error', 'oops'))
    const store = useAuthStore()
    await store.init()
    expect(store.serviceUnavailable).toBe(true)
    expect(store.user).toBeNull()
  })
})

describe('auth.store — sendMagicLink', () => {
  it('calls api.auth.sendMagicLink with the email', async () => {
    vi.mocked(api.auth.sendMagicLink).mockResolvedValue(undefined)
    const store = useAuthStore()
    await store.sendMagicLink('user@example.com')
    expect(api.auth.sendMagicLink).toHaveBeenCalledWith('user@example.com')
  })

  it('propagates errors from the API', async () => {
    vi.mocked(api.auth.sendMagicLink).mockRejectedValue(new Error('Rate limited'))
    const store = useAuthStore()
    await expect(store.sendMagicLink('user@example.com')).rejects.toThrow('Rate limited')
  })
})

describe('auth.store — verifyMagicLink', () => {
  it('stores the token and the user on success', async () => {
    const user = { id: 'u1', email: 'test@example.com' }
    vi.mocked(api.auth.verify).mockResolvedValue({ access_token: 'jwt', user })
    const store = useAuthStore()
    await store.verifyMagicLink('one-time-token')
    expect(setToken).toHaveBeenCalledWith('jwt')
    expect(store.user).toEqual(user)
  })

  it('propagates errors and does not set user', async () => {
    vi.mocked(api.auth.verify).mockRejectedValue(new ApiError(400, 'bad', 'expired'))
    const store = useAuthStore()
    await expect(store.verifyMagicLink('bad-token')).rejects.toThrow('expired')
    expect(setToken).not.toHaveBeenCalled()
    expect(store.user).toBeNull()
  })
})

describe('auth.store — signOut', () => {
  it('calls api.auth.logout, clears the token, and unsets user', async () => {
    vi.mocked(api.auth.logout).mockResolvedValue(undefined)
    const store = useAuthStore()
    store.user = { id: 'u1', email: 'a@b.com' }
    await store.signOut()
    expect(api.auth.logout).toHaveBeenCalled()
    expect(clearToken).toHaveBeenCalled()
    expect(store.user).toBeNull()
  })

  it('still clears local state when logout fails', async () => {
    vi.mocked(api.auth.logout).mockRejectedValue(new Error('network'))
    const store = useAuthStore()
    store.user = { id: 'u1', email: 'a@b.com' }
    await store.signOut()
    expect(clearToken).toHaveBeenCalled()
    expect(store.user).toBeNull()
  })

  it('clears every domain store so a different user logging in starts fresh', async () => {
    vi.mocked(api.auth.logout).mockResolvedValue(undefined)
    const { useVehiclesStore } = await import('@/stores/vehicles.store')
    const { useMaintenanceStore } = await import('@/stores/maintenance.store')
    const { useSettingsStore } = await import('@/stores/settings.store')

    const vehicles = useVehiclesStore()
    const maintenance = useMaintenanceStore()
    const settings = useSettingsStore()

    // Seed each store with mock state from a "previous" session.
    vehicles.vehicles = [{ id: 'v1' } as never]
    maintenance.records = [{ id: 'r1' } as never]
    settings.settings = { user_id: 'u1', locale: 'en', default_reminder_lead_days: 30 } as never

    const auth = useAuthStore()
    auth.user = { id: 'u1', email: 'a@b.com' }
    await auth.signOut()

    expect(vehicles.vehicles).toEqual([])
    expect(maintenance.records).toEqual([])
    expect(settings.settings).toBeNull()
  })
})

describe('auth.store — 401 handler', () => {
  it('clears user, redirects, and resets every domain store on 401', async () => {
    vi.mocked(api.health).mockResolvedValue(true)
    vi.mocked(getToken).mockReturnValue(null)

    const { useVehiclesStore } = await import('@/stores/vehicles.store')
    const { useMaintenanceStore } = await import('@/stores/maintenance.store')
    const vehicles = useVehiclesStore()
    const maintenance = useMaintenanceStore()
    vehicles.vehicles = [{ id: 'v1' } as never]
    maintenance.records = [{ id: 'r1' } as never]

    const { setUnauthenticatedRedirect } = await import('@/stores/auth.store')
    const redirect = vi.fn()
    setUnauthenticatedRedirect(redirect)

    const auth = useAuthStore()
    auth.user = { id: 'u1', email: 'a@b.com' }
    await auth.init()
    expect(registered401Handler).toBeTypeOf('function')

    // Fire the handler the API client would invoke after a real 401.
    registered401Handler?.()
    // Redirect runs synchronously; user is cleared synchronously too.
    expect(auth.user).toBeNull()
    expect(redirect).toHaveBeenCalled()
    // Domain-store resets are dispatched via async dynamic imports — wait a
    // few macrotasks for the import chain to settle before asserting.
    await new Promise<void>((r) => setTimeout(r, 20))
    expect(vehicles.vehicles).toEqual([])
    expect(maintenance.records).toEqual([])

    setUnauthenticatedRedirect(null)
  })
})

describe('auth.store — retryConnection', () => {
  it('resets serviceUnavailable and re-runs init', async () => {
    vi.mocked(api.health).mockResolvedValue(false)
    vi.mocked(getToken).mockReturnValue(null)
    const store = useAuthStore()
    await store.init()
    expect(store.serviceUnavailable).toBe(true)

    vi.mocked(api.health).mockResolvedValue(true)
    await store.retryConnection()
    expect(store.serviceUnavailable).toBe(false)
  })
})
