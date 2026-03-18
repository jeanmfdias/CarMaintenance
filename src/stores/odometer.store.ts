import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import { useVehiclesStore } from './vehicles.store'
import type { OdometerEntry, OdometerEntryInsert, OdometerEntryUpdate } from '@/types'

export const useOdometerStore = defineStore('odometer', () => {
  const entries = ref<OdometerEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('odometer_entries')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('reading_date', { ascending: false })
      if (err) throw err
      entries.value = (data as OdometerEntry[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: OdometerEntryInsert): Promise<OdometerEntry> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('odometer_entries')
      .insert({ ...payload, user_id: auth.user!.id })
      .select()
      .single()
    if (err) throw err
    const entry = data as OdometerEntry
    entries.value.unshift(entry)
    const vehiclesStore = useVehiclesStore()
    const vehicle = vehiclesStore.vehicles.find((v) => v.id === entry.vehicle_id)
    if (vehicle && entry.reading_km > vehicle.current_odometer) {
      await vehiclesStore.update(vehicle.id, { current_odometer: entry.reading_km })
    }
    return entry
  }

  async function update(id: string, payload: OdometerEntryUpdate): Promise<OdometerEntry> {
    const { data, error: err } = await supabase
      .from('odometer_entries')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const entry = data as OdometerEntry
    const idx = entries.value.findIndex((e) => e.id === id)
    if (idx !== -1) entries.value[idx] = entry
    if (payload.reading_km !== undefined) {
      const vehiclesStore = useVehiclesStore()
      const vehicle = vehiclesStore.vehicles.find((v) => v.id === entry.vehicle_id)
      if (vehicle && entry.reading_km > vehicle.current_odometer) {
        await vehiclesStore.update(vehicle.id, { current_odometer: entry.reading_km })
      }
    }
    return entry
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('odometer_entries').delete().eq('id', id)
    if (err) throw err
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return { entries, loading, error, fetchByVehicle, create, update, remove }
})
