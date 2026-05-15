import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import { useVehiclesStore } from './vehicles.store'
import { useOdometerStore } from './odometer.store'
import type { FuelFillup, FuelFillupInsert, FuelFillupUpdate } from '@/types'

export const useFuelStore = defineStore('fuel', () => {
  const fillups = ref<FuelFillup[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset() {
    fillups.value = []
    loading.value = false
    error.value = null
  }

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      fillups.value = await api.fuel.listByVehicle(vehicleId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload: FuelFillupInsert): Promise<FuelFillup> {
    const { vehicle_id, ...body } = payload
    const fillup = await api.fuel.create(vehicle_id, body)
    // Insert in correct odometer order
    const idx = fillups.value.findIndex((f) => f.odometer_km > fillup.odometer_km)
    if (idx === -1) {
      fillups.value.push(fillup)
    } else {
      fillups.value.splice(idx, 0, fillup)
    }
    // Backend already updates vehicle.current_odometer and inserts a mirrored
    // odometer_entries row server-side. Sync the local Vehicle so the in-memory
    // state matches without refetching.
    await useVehiclesStore().syncOdometer(fillup.vehicle_id, fillup.odometer_km)
    // Refresh the odometer entries list locally so callers that have the
    // odometer screen open see the server-mirrored row.
    const odoStore = useOdometerStore()
    if (odoStore.entries.some((e) => e.vehicle_id === fillup.vehicle_id)) {
      await odoStore.fetchByVehicle(fillup.vehicle_id)
    }
    return fillup
  }

  async function update(id: string, payload: FuelFillupUpdate): Promise<FuelFillup> {
    const fillup = await api.fuel.update(id, payload)
    const idx = fillups.value.findIndex((f) => f.id === id)
    if (idx !== -1) fillups.value[idx] = fillup
    // Re-sort by odometer after update
    fillups.value.sort((a, b) => a.odometer_km - b.odometer_km)
    if (payload.odometer_km !== undefined) {
      await useVehiclesStore().syncOdometer(fillup.vehicle_id, fillup.odometer_km)
    }
    return fillup
  }

  async function remove(id: string) {
    await api.fuel.remove(id)
    fillups.value = fillups.value.filter((f) => f.id !== id)
  }

  return { fillups, loading, error, reset, fetchByVehicle, create, update, remove }
})
