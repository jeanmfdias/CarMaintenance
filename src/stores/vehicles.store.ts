import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/lib/api'
import type { Vehicle, VehicleInsert, VehicleUpdate } from '@/types'

export const useVehiclesStore = defineStore('vehicles', () => {
  const vehicles = ref<Vehicle[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeVehicles = computed(() => vehicles.value.filter((v) => !v.sell_date))
  const archivedVehicles = computed(() => vehicles.value.filter((v) => !!v.sell_date))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      vehicles.value = await api.vehicles.list()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: VehicleInsert): Promise<Vehicle> {
    const vehicle = await api.vehicles.create(payload)
    vehicles.value.unshift(vehicle)
    if (vehicle.current_odometer > 0 && vehicle.purchase_date) {
      const { useOdometerStore } = await import('./odometer.store')
      await useOdometerStore().create({
        vehicle_id: vehicle.id,
        reading_km: vehicle.current_odometer,
        reading_date: vehicle.purchase_date,
        notes: null,
      })
    }
    return vehicle
  }

  async function update(id: string, payload: VehicleUpdate): Promise<Vehicle> {
    const vehicle = await api.vehicles.update(id, payload)
    const idx = vehicles.value.findIndex((v) => v.id === id)
    if (idx !== -1) vehicles.value[idx] = vehicle
    return vehicle
  }

  async function remove(id: string) {
    await api.vehicles.remove(id)
    vehicles.value = vehicles.value.filter((v) => v.id !== id)
  }

  async function archive(id: string, sellDate: string) {
    return update(id, { sell_date: sellDate })
  }

  /**
   * Upload a vehicle photo. The backend returns the updated Vehicle row
   * with `photo_url` set to the new server-relative path.
   */
  async function uploadPhoto(vehicleId: string, file: File): Promise<Vehicle> {
    const updated = await api.vehicles.uploadPhoto(vehicleId, file)
    const idx = vehicles.value.findIndex((v) => v.id === vehicleId)
    if (idx !== -1) vehicles.value[idx] = updated
    return updated
  }

  async function removePhoto(vehicleId: string): Promise<Vehicle> {
    const updated = await api.vehicles.removePhoto(vehicleId)
    const idx = vehicles.value.findIndex((v) => v.id === vehicleId)
    if (idx !== -1) vehicles.value[idx] = updated
    return updated
  }

  /**
   * Resolve a stored `photo_url` (relative server path) into a displayable
   * URL. Returns a blob: object URL since the upload endpoint is bearer-gated.
   */
  async function getPhotoUrl(path: string): Promise<string> {
    const url = await api.vehicles.photoUrl(path)
    if (!url) throw new Error('No photo path')
    return url
  }

  async function syncOdometer(vehicleId: string, km: number | null): Promise<void> {
    if (km === null) return
    const vehicle = vehicles.value.find((v) => v.id === vehicleId)
    if (vehicle && km > vehicle.current_odometer) {
      await update(vehicle.id, { current_odometer: km })
    }
  }

  return {
    vehicles,
    loading,
    error,
    activeVehicles,
    archivedVehicles,
    fetchAll,
    create,
    update,
    remove,
    archive,
    uploadPhoto,
    removePhoto,
    getPhotoUrl,
    syncOdometer,
  }
})
