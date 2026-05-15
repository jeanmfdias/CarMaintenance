import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { ServiceProvider, ServiceProviderInsert, ServiceProviderUpdate } from '@/types'

export const useProvidersStore = defineStore('providers', () => {
  const providers = ref<ServiceProvider[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset() {
    providers.value = []
    loading.value = false
    error.value = null
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      providers.value = await api.providers.list()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload: ServiceProviderInsert): Promise<ServiceProvider> {
    const provider = await api.providers.create(payload)
    providers.value.push(provider)
    providers.value.sort((a, b) => a.name.localeCompare(b.name))
    return provider
  }

  async function update(id: string, payload: ServiceProviderUpdate): Promise<ServiceProvider> {
    const provider = await api.providers.update(id, payload)
    const idx = providers.value.findIndex((p) => p.id === id)
    if (idx !== -1) providers.value[idx] = provider
    return provider
  }

  async function remove(id: string) {
    await api.providers.remove(id)
    providers.value = providers.value.filter((p) => p.id !== id)
  }

  return { providers, loading, error, reset, fetchAll, create, update, remove }
})
