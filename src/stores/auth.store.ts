import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const serviceUnavailable = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function checkReachability(): Promise<boolean> {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
      await fetch(url, { signal: AbortSignal.timeout(5000) })
      return true
    } catch {
      return false
    }
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

    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
    })
  }

  async function retryConnection() {
    await init()
  }

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, session, loading, serviceUnavailable, isAuthenticated, init, retryConnection, sendMagicLink, signOut }
})
