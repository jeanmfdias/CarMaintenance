import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import { i18n } from '@/plugins/i18n'
import type { UserSettings } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    const auth = useAuthStore()
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', auth.user!.id)
        .maybeSingle()
      if (err) throw err
      settings.value = data as UserSettings | null
      if (settings.value?.locale) {
        i18n.global.locale.value = settings.value.locale
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function save(payload: Partial<Pick<UserSettings, 'locale' | 'default_reminder_lead_days'>>) {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('user_settings')
      .upsert({ ...payload, user_id: auth.user!.id }, { onConflict: 'user_id' })
      .select()
      .single()
    if (err) throw err
    settings.value = data as UserSettings
    if (payload.locale) {
      i18n.global.locale.value = payload.locale
    }
  }

  return { settings, loading, error, fetch, save }
})
