import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import type { InsurancePolicy, InsurancePolicyInsert, InsurancePolicyUpdate } from '@/types'

export const useInsuranceStore = defineStore('insurance', () => {
  const policies = ref<InsurancePolicy[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      policies.value = await api.insurance.listByVehicle(vehicleId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: InsurancePolicyInsert): Promise<InsurancePolicy> {
    const { vehicle_id, ...body } = payload
    const policy = await api.insurance.create(vehicle_id, body)
    policies.value.push(policy)
    policies.value.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
    return policy
  }

  async function update(id: string, payload: InsurancePolicyUpdate): Promise<InsurancePolicy> {
    const policy = await api.insurance.update(id, payload)
    const idx = policies.value.findIndex((p) => p.id === id)
    if (idx !== -1) policies.value[idx] = policy
    return policy
  }

  async function remove(id: string) {
    await api.insurance.remove(id)
    policies.value = policies.value.filter((p) => p.id !== id)
  }

  return { policies, loading, error, fetchByVehicle, create, update, remove }
})
