import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
import { useVehiclesStore } from './vehicles.store'
import { useOdometerStore } from './odometer.store'
import type { FuelFillup, FuelFillupInsert, FuelFillupUpdate } from '@/types'

export const useFuelStore = defineStore('fuel', () => {
  const fillups = ref<FuelFillup[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('fuel_fillups')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('odometer_km', { ascending: true })
      if (err) throw err
      fillups.value = (data as FuelFillup[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: FuelFillupInsert): Promise<FuelFillup> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('fuel_fillups')
      .insert({ ...payload, user_id: auth.user!.id })
      .select()
      .single()
    if (err) throw err
    const fillup = data as FuelFillup
    // Insert in correct odometer order
    const idx = fillups.value.findIndex((f) => f.odometer_km > fillup.odometer_km)
    if (idx === -1) {
      fillups.value.push(fillup)
    } else {
      fillups.value.splice(idx, 0, fillup)
    }
    await useVehiclesStore().syncOdometer(fillup.vehicle_id, fillup.odometer_km)
    await useOdometerStore().create({
      vehicle_id: fillup.vehicle_id,
      reading_km: fillup.odometer_km,
      reading_date: fillup.fillup_date,
      notes: null,
    })
    return fillup
  }

  async function update(id: string, payload: FuelFillupUpdate): Promise<FuelFillup> {
    const { data, error: err } = await supabase
      .from('fuel_fillups')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const fillup = data as FuelFillup
    const idx = fillups.value.findIndex((f) => f.id === id)
    if (idx !== -1) fillups.value[idx] = fillup
    // Re-sort by odometer after update
    fillups.value.sort((a, b) => a.odometer_km - b.odometer_km)
    if (payload.odometer_km !== undefined) {
      await useVehiclesStore().syncOdometer(fillup.vehicle_id, fillup.odometer_km)
      await useOdometerStore().create({
        vehicle_id: fillup.vehicle_id,
        reading_km: fillup.odometer_km,
        reading_date: fillup.fillup_date,
        notes: null,
      })
    }
    return fillup
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('fuel_fillups').delete().eq('id', id)
    if (err) throw err
    fillups.value = fillups.value.filter((f) => f.id !== id)
  }

  return { fillups, loading, error, fetchByVehicle, create, update, remove }
})
