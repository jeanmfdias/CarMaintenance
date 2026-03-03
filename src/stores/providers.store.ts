import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { ServiceProvider, ServiceProviderInsert, ServiceProviderUpdate } from '@/types'

export const useProvidersStore = defineStore('providers', () => {
  const providers = ref<ServiceProvider[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('service_providers')
        .select('*')
        .order('name', { ascending: true })
      if (err) throw err
      providers.value = (data as ServiceProvider[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: ServiceProviderInsert): Promise<ServiceProvider> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('service_providers')
      .insert({ ...payload, user_id: auth.user!.id })
      .select()
      .single()
    if (err) throw err
    const provider = data as ServiceProvider
    providers.value.push(provider)
    providers.value.sort((a, b) => a.name.localeCompare(b.name))
    return provider
  }

  async function update(id: string, payload: ServiceProviderUpdate): Promise<ServiceProvider> {
    const { data, error: err } = await supabase
      .from('service_providers')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const provider = data as ServiceProvider
    const idx = providers.value.findIndex((p) => p.id === id)
    if (idx !== -1) providers.value[idx] = provider
    return provider
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('service_providers').delete().eq('id', id)
    if (err) throw err
    providers.value = providers.value.filter((p) => p.id !== id)
  }

  return { providers, loading, error, fetchAll, create, update, remove }
})
