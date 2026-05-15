import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import { i18n } from '@/plugins/i18n'
import type { UserSettings } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset() {
    settings.value = null
    loading.value = false
    error.value = null
  }

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const data = await api.settings.get()
      settings.value = data
      if (data?.locale) {
        i18n.global.locale.value = data.locale
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function save(payload: Partial<Pick<UserSettings, 'locale' | 'default_reminder_lead_days'>>) {
    const data = await api.settings.update(payload)
    settings.value = data
    if (payload.locale) {
      i18n.global.locale.value = payload.locale
    }
  }

  return { settings, loading, error, reset, fetch, save }
})
