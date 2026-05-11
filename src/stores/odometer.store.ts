import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/lib/api'
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
      entries.value = await api.odometer.listByVehicle(vehicleId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: OdometerEntryInsert): Promise<OdometerEntry> {
    const { vehicle_id, ...body } = payload
    const entry = await api.odometer.create(vehicle_id, body)
    entries.value.unshift(entry)
    await useVehiclesStore().syncOdometer(entry.vehicle_id, entry.reading_km)
    return entry
  }

  /**
   * Update is unsupported by the new backend (no PATCH on odometer entries).
   * The legacy interface is preserved for compatibility — implemented as a
   * delete-then-recreate to keep callers working.
   */
  async function update(id: string, payload: OdometerEntryUpdate): Promise<OdometerEntry> {
    const existing = entries.value.find((e) => e.id === id)
    if (!existing) throw new Error('Entry not found')
    await api.odometer.remove(id)
    entries.value = entries.value.filter((e) => e.id !== id)
    const merged: OdometerEntryInsert = {
      vehicle_id: existing.vehicle_id,
      reading_km: payload.reading_km ?? existing.reading_km,
      reading_date: payload.reading_date ?? existing.reading_date,
      notes: payload.notes ?? existing.notes,
    }
    return create(merged)
  }

  async function remove(id: string) {
    await api.odometer.remove(id)
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  return { entries, loading, error, fetchByVehicle, create, update, remove }
})
