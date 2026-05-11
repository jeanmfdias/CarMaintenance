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

  async function fetchByVehicle(vehicleId: string) {
    loading.value = true
    error.value = null
    try {
      records.value = await api.maintenance.listByVehicle(vehicleId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: MaintenanceRecordInsert): Promise<MaintenanceRecord> {
    const { vehicle_id, ...body } = payload
    const record = await api.maintenance.create(vehicle_id, body)
    records.value.unshift(record)
    // Backend already syncs vehicle.current_odometer for maintenance creates.
    // We still call syncOdometer locally so the in-memory Vehicle reflects it.
    await useVehiclesStore().syncOdometer(record.vehicle_id, record.odometer_km)
    // The maintenance route does NOT mirror an odometer_entries row server-side
    // (only the fuel route does), so we still create the mirror here.
    if (record.odometer_km != null) {
      await useOdometerStore().create({
        vehicle_id: record.vehicle_id,
        reading_km: record.odometer_km,
        reading_date: record.record_date,
        notes: null,
      })
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

  return { records, loading, error, fetchByVehicle, create, update, remove }
})
