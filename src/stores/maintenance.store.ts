import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
import { useVehiclesStore } from './vehicles.store'
import { useOdometerStore } from './odometer.store'
import type { MaintenanceRecord, MaintenanceRecordInsert, MaintenanceRecordUpdate } from '@/types'

export const useMaintenanceStore = defineStore('maintenance', () => {
  const records = ref<MaintenanceRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  function reset() {
    records.value = []
    loading.value = false
    error.value = null
  }

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      records.value = await api.maintenance.listByVehicle(vehicleId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function create(payload: MaintenanceRecordInsert): Promise<MaintenanceRecord> {
    const { vehicle_id, ...body } = payload
    const record = await api.maintenance.create(vehicle_id, body)
    records.value.unshift(record)
    // Backend syncs vehicle.current_odometer AND mirrors an odometer_entries
    // row server-side (see server/src/routes/maintenance.ts). We mirror the
    // bump in local Vehicle state, and refresh the odometer store if it has
    // entries for this vehicle so the UI reflects the new row.
    await useVehiclesStore().syncOdometer(record.vehicle_id, record.odometer_km)
    if (record.odometer_km != null) {
      const odoStore = useOdometerStore()
      if (odoStore.entries.some((e) => e.vehicle_id === record.vehicle_id)) {
        await odoStore.fetchByVehicle(record.vehicle_id)
      }
    }
    return record
  }

  async function update(id: string, payload: MaintenanceRecordUpdate): Promise<MaintenanceRecord> {
    const record = await api.maintenance.update(id, payload)
    const idx = records.value.findIndex((r) => r.id === id)
    if (idx !== -1) records.value[idx] = record
    if (payload.odometer_km !== undefined) {
      await useVehiclesStore().syncOdometer(record.vehicle_id, record.odometer_km)
    }
    return record
  }

  async function remove(id: string) {
    await api.maintenance.remove(id)
    records.value = records.value.filter((r) => r.id !== id)
  }

  return { records, loading, error, reset, fetchByVehicle, create, update, remove }
})
