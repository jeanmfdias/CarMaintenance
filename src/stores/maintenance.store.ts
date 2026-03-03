import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import type { MaintenanceRecord, MaintenanceRecordInsert, MaintenanceRecordUpdate } from '@/types'

export const useMaintenanceStore = defineStore('maintenance', () => {
  const records = ref<MaintenanceRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('maintenance_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('record_date', { ascending: false })
      if (err) throw err
      records.value = (data as MaintenanceRecord[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: MaintenanceRecordInsert): Promise<MaintenanceRecord> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('maintenance_records')
      .insert({ ...payload, user_id: auth.user!.id, reminder_sent: false })
      .select()
      .single()
    if (err) throw err
    const record = data as MaintenanceRecord
    records.value.unshift(record)
    return record
  }

  async function update(id: string, payload: MaintenanceRecordUpdate): Promise<MaintenanceRecord> {
    const { data, error: err } = await supabase
      .from('maintenance_records')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const record = data as MaintenanceRecord
    const idx = records.value.findIndex((r) => r.id === id)
    if (idx !== -1) records.value[idx] = record
    return record
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('maintenance_records').delete().eq('id', id)
    if (err) throw err
    records.value = records.value.filter((r) => r.id !== id)
  }

  return { records, loading, error, fetchByVehicle, create, update, remove }
})
