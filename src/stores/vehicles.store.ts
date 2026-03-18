import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './auth.store'
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
      const { data, error: err } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      vehicles.value = (data as Vehicle[]) ?? []
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: VehicleInsert): Promise<Vehicle> {
    const auth = useAuthStore()
    const { data, error: err } = await supabase
      .from('vehicles')
      .insert({ ...payload, user_id: auth.user!.id })
      .select()
      .single()
    if (err) throw err
    const vehicle = data as Vehicle
    vehicles.value.unshift(vehicle)
    return vehicle
  }

  async function update(id: string, payload: VehicleUpdate): Promise<Vehicle> {
    const { data, error: err } = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    const vehicle = data as Vehicle
    const idx = vehicles.value.findIndex((v) => v.id === id)
    if (idx !== -1) vehicles.value[idx] = vehicle
    return vehicle
  }

  async function remove(id: string) {
    const { error: err } = await supabase.from('vehicles').delete().eq('id', id)
    if (err) throw err
    vehicles.value = vehicles.value.filter((v) => v.id !== id)
  }

  async function archive(id: string, sellDate: string) {
    return update(id, { sell_date: sellDate })
  }

  async function uploadPhoto(vehicleId: string, file: File): Promise<string> {
    const auth = useAuthStore()
    const ext = file.name.split('.').pop()
    const path = `${auth.user!.id}/${vehicleId}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('vehicle-photos')
      .upload(path, file, { upsert: true })
    if (uploadErr) throw uploadErr
    return path
  }

  async function getPhotoUrl(path: string): Promise<string> {
    const { data, error: err } = await supabase.storage
      .from('vehicle-photos')
      .createSignedUrl(path, 3600)
    if (err) throw err
    return data.signedUrl
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
    getPhotoUrl,
    syncOdometer,
  }
})
