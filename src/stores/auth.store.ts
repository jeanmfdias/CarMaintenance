import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api, getToken, setToken, clearToken, onUnauthorized, ApiError } from '@/lib/api'
import type { AuthUser } from '@/lib/api'

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

    // Wire up a 401 handler — clears local user when token is rejected.
    onUnauthorized(() => {
      user.value = null
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
