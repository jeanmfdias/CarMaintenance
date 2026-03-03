import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { InsurancePolicy, InsurancePolicyInsert, InsurancePolicyUpdate } from '@/types'

export const useInsuranceStore = defineStore('insurance', () => {
  const policies = ref<InsurancePolicy[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('expiry_date', { ascending: true })
      if (err) throw err
      policies.value = (data as InsurancePolicy[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: InsurancePolicyInsert): Promise<InsurancePolicy> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('insurance_policies')
      .insert({ ...payload, user_id: auth.user!.id, reminder_sent: false })
      .select()
      .single()
    if (err) throw err
    const policy = data as InsurancePolicy
    policies.value.push(policy)
    policies.value.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
    return policy
  }

  async function update(id: string, payload: InsurancePolicyUpdate): Promise<InsurancePolicy> {
    const { data, error: err } = await supabase
      .from('insurance_policies')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const policy = data as InsurancePolicy
    const idx = policies.value.findIndex((p) => p.id === id)
    if (idx !== -1) policies.value[idx] = policy
    return policy
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('insurance_policies').delete().eq('id', id)
    if (err) throw err
    policies.value = policies.value.filter((p) => p.id !== id)
  }

  return { policies, loading, error, fetchByVehicle, create, update, remove }
})
