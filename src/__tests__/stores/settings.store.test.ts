import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings.store'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('@/plugins/i18n', () => ({
  i18n: {
    global: { locale: { value: 'en' } },
  },
}))

import { supabase } from '@/lib/supabase'
import { i18n } from '@/plugins/i18n'

function makeQueryBuilder(result: { data?: any; error?: any }) {
  const b: any = {}
  ;['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order'].forEach((m) => {
    b[m] = vi.fn().mockReturnValue(b)
  })
  b.single = vi.fn().mockResolvedValue(result)
  b.maybeSingle = vi.fn().mockResolvedValue(result)
  b.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return b
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().user = { id: 'u1' } as any
  i18n.global.locale.value = 'en'
})

describe('settings.store — fetch', () => {
  it('loads settings when they exist', async () => {
    const data = { user_id: 'u1', locale: 'pt-BR', default_reminder_lead_days: 30 }
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useSettingsStore()
    await store.fetch()
    expect(store.settings).toEqual(data)
    expect(store.error).toBeNull()
  })

  it('updates i18n locale when settings have a locale', async () => {
    const data = { user_id: 'u1', locale: 'pt-BR', default_reminder_lead_days: 30 }
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useSettingsStore()
    await store.fetch()
    expect(i18n.global.locale.value).toBe('pt-BR')
  })

  it('does not crash when settings are null (first time user)', async () => {
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data: null, error: null }) as any)
    const store = useSettingsStore()
    await store.fetch()
    expect(store.settings).toBeNull()
    expect(store.error).toBeNull()
  })

  it('sets error on DB failure', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('DB error') }) as any,
    )
    const store = useSettingsStore()
    await store.fetch()
    expect(store.error).toBe('DB error')
  })
})

describe('settings.store — save', () => {
  it('saves settings and updates locale', async () => {
    const data = { user_id: 'u1', locale: 'pt-BR', default_reminder_lead_days: 30 }
    vi.mocked(supabase.from).mockReturnValue(makeQueryBuilder({ data, error: null }) as any)
    const store = useSettingsStore()
    await store.save({ locale: 'pt-BR', default_reminder_lead_days: 30 })
    expect(store.settings).toEqual(data)
    expect(i18n.global.locale.value).toBe('pt-BR')
  })

  it('throws on error', async () => {
    vi.mocked(supabase.from).mockReturnValue(
      makeQueryBuilder({ data: null, error: new Error('Save failed') }) as any,
    )
    const store = useSettingsStore()
    await expect(store.save({ locale: 'en' })).rejects.toThrow('Save failed')
  })
})
