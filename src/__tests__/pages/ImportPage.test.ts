import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ImportPage from '@/pages/import/ImportPage.vue'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useAuthStore } from '@/stores/auth.store'
import en from '@/locales/en'
import type { ImportResult } from '@/utils/importData'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}))

vi.mock('@/composables/useSnackbar', () => ({
  showSnackbar: vi.fn(),
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })

const stubs = {
  VContainer: { template: '<div><slot /></div>' },
  VCard: { template: '<div><slot /></div>' },
  VCardText: { template: '<div><slot /></div>' },
  VCardActions: { template: '<div><slot /></div>' },
  VSelect: { template: '<div />' },
  VBtn: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
  VAlert: { template: '<div />' },
  VTable: { template: '<div />' },
  VSpacer: { template: '<div />' },
  VChip: { template: '<div />' },
}

function makeImportResult(rows: { odometer_km: number | null }[]): ImportResult {
  return {
    valid: rows.map((r, i) => ({
      record_date: `2024-0${i + 1}-01`,
      category: 'oil_change' as const,
      odometer_km: r.odometer_km,
      total_cost: 100,
      notes: '',
    })),
    errors: [],
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  useAuthStore().user = { id: 'u1' } as any
})

describe('ImportPage — runImport odometer sync', () => {
  it('calls syncOdometer with the highest km from the batch', async () => {
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 10000 } as any]
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()

    const maintenanceStore = useMaintenanceStore()
    vi.spyOn(maintenanceStore, 'create').mockResolvedValue({} as any)

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })

    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([
      { odometer_km: 20000 },
      { odometer_km: 15000 },
      { odometer_km: 25000 },
    ])

    await wrapper.vm.runImport()

    expect(syncSpy).toHaveBeenLastCalledWith('v1', 25000)
  })

  it('calls syncOdometer with null when no row has an odometer reading', async () => {
    const vehiclesStore = useVehiclesStore()
    vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 10000 } as any]
    const syncSpy = vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()

    const maintenanceStore = useMaintenanceStore()
    vi.spyOn(maintenanceStore, 'create').mockResolvedValue({} as any)

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })

    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([{ odometer_km: null }, { odometer_km: null }])

    await wrapper.vm.runImport()

    expect(syncSpy).toHaveBeenLastCalledWith('v1', null)
  })
})
