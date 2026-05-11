import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings.store'

vi.mock('@/lib/api', () => ({
  api: {
    settings: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/plugins/i18n', () => ({
  i18n: {
    global: { locale: { value: 'en' } },
  },
}))

import { api } from '@/lib/api'
import { i18n } from '@/plugins/i18n'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
})

describe('settings.store — fetch', () => {
  it('loads settings and updates locale', async () => {
    const data = {
      user_id: 'u1',
      locale: 'pt-BR' as const,
      default_reminder_lead_days: 30,
      created_at: '',
      updated_at: '',
    }
    vi.mocked(api.settings.get).mockResolvedValue(data)
    const store = useSettingsStore()
    await store.fetch()
    expect(store.settings).toEqual(data)
    expect(i18n.global.locale.value).toBe('pt-BR')
  })

  it('sets error on failure', async () => {
    vi.mocked(api.settings.get).mockRejectedValue(new Error('DB error'))
    const store = useSettingsStore()
    await store.fetch()
    expect(store.error).toBe('DB error')
  })
})

describe('settings.store — save', () => {
  it('saves settings and updates locale', async () => {
    const data = {
      user_id: 'u1',
      locale: 'pt-BR' as const,
      default_reminder_lead_days: 30,
      created_at: '',
      updated_at: '',
    }
    vi.mocked(api.settings.update).mockResolvedValue(data)
    const store = useSettingsStore()
    await store.save({ locale: 'pt-BR', default_reminder_lead_days: 30 })
    expect(store.settings).toEqual(data)
    expect(i18n.global.locale.value).toBe('pt-BR')
  })

  it('throws on error', async () => {
    vi.mocked(api.settings.update).mockRejectedValue(new Error('Save failed'))
    const store = useSettingsStore()
    await expect(store.save({ locale: 'en' })).rejects.toThrow('Save failed')
  })
})
