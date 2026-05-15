import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, getToken, setToken, clearToken, onUnauthorized, ApiError } from '@/lib/api'
import type { AuthUser } from '@/lib/api'

/**
 * Clear every domain store's local state. Called on sign-out and on 401 so
 * that switching accounts (or a token expiry) never leaks data from a previous
 * session into the new one.
 *
 * Imports are dynamic to avoid a circular dependency: domain stores import the
 * API client, the API client does not import stores, and the auth store sits
 * above both — touching domain stores only when a session boundary is crossed.
 */
async function clearAllDomainStores() {
  const [
    { useVehiclesStore },
    { useMaintenanceStore },
    { useFuelStore },
    { useOdometerStore },
    { useInsuranceStore },
    { useProvidersStore },
    { useSettingsStore },
  ] = await Promise.all([
    import('./vehicles.store'),
    import('./maintenance.store'),
    import('./fuel.store'),
    import('./odometer.store'),
    import('./insurance.store'),
    import('./providers.store'),
    import('./settings.store'),
  ])
  useVehiclesStore().reset()
  useMaintenanceStore().reset()
  useFuelStore().reset()
  useOdometerStore().reset()
  useInsuranceStore().reset()
  useProvidersStore().reset()
  useSettingsStore().reset()
}

/**
 * Optional callback invoked after a 401 — used by the router to bounce the
 * user to /login without the store needing to import the router (and create
 * a circular import).
 */
let onUnauthenticatedRedirect: (() => void) | null = null
export function setUnauthenticatedRedirect(cb: (() => void) | null) {
  onUnauthenticatedRedirect = cb
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(true)
  const serviceUnavailable = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function checkReachability(): Promise<boolean> {
    return api.health()
  }

  async function init() {
    loading.value = true
    serviceUnavailable.value = false

    const reachable = await checkReachability()
    if (!reachable) {
      serviceUnavailable.value = true
      loading.value = false
      return
    }

    // Wire up a 401 handler — clears local user AND every domain store so a
    // subsequent login (possibly as a different user) starts from a clean slate,
    // and asks the router to bounce to /login if a callback was registered.
    onUnauthorized(() => {
      user.value = null
      // Fire-and-forget: we cannot await inside the synchronous handler, but
      // store resets are pure local-state mutations so they complete on the
      // next microtask.
      void clearAllDomainStores()
      onUnauthenticatedRedirect?.()
    })

    const token = getToken()
    if (!token) {
      user.value = null
      loading.value = false
      return
    }

    try {
      const me = await api.auth.me()
      user.value = me
    } catch (e) {
      // 401 → token already cleared by the request layer
      if (!(e instanceof ApiError) || e.status !== 401) {
        // Non-auth error: surface as service unavailable so the user can retry
        serviceUnavailable.value = true
      }
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function retryConnection() {
    await init()
  }

  async function sendMagicLink(email: string) {
    await api.auth.sendMagicLink(email)
  }

  async function verifyMagicLink(token: string): Promise<void> {
    const { access_token, user: u } = await api.auth.verify(token)
    setToken(access_token)
    user.value = u
  }

  async function signOut() {
    try {
      await api.auth.logout()
    } catch {
      // best-effort
    }
    clearToken()
    user.value = null
    await clearAllDomainStores()
  }

  return {
    user,
    loading,
    serviceUnavailable,
    isAuthenticated,
    init,
    retryConnection,
    sendMagicLink,
    verifyMagicLink,
    signOut,
  }
})
