import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import ImportPage from '@/pages/import/ImportPage.vue'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useOdometerStore } from '@/stores/odometer.store'
import { useAuthStore } from '@/stores/auth.store'
import en from '@/locales/en'
import type { ImportResult } from '@/utils/importData'
import type { OdometerEntry } from '@/types'

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

function makeImportResult(rows: { odometer_km: number | null; record_date?: string }[]): ImportResult {
  return {
    valid: rows.map((r, i) => ({
      record_date: r.record_date ?? `2024-0${i + 1}-01`,
      category: 'oil_change' as const,
      odometer_km: r.odometer_km,
      total_cost: 100,
      notes: '',
    })),
    errors: [],
  }
}

function setupOdometerMocks(existingEntries: Partial<OdometerEntry>[] = []) {
  const odometerStore = useOdometerStore()
  odometerStore.entries = existingEntries as OdometerEntry[]
  vi.spyOn(odometerStore, 'fetchByVehicle').mockResolvedValue()
  const createSpy = vi.spyOn(odometerStore, 'create').mockResolvedValue({} as any)
  return { odometerStore, createSpy }
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
    vi.spyOn(useMaintenanceStore(), 'create').mockResolvedValue({} as any)
    setupOdometerMocks()

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
    vi.spyOn(useMaintenanceStore(), 'create').mockResolvedValue({} as any)
    setupOdometerMocks()

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })
    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([{ odometer_km: null }, { odometer_km: null }])

    await wrapper.vm.runImport()

    expect(syncSpy).toHaveBeenLastCalledWith('v1', null)
  })
})

function baseSetup() {
  const vehiclesStore = useVehiclesStore()
  vehiclesStore.vehicles = [{ id: 'v1', current_odometer: 0 } as any]
  vi.spyOn(vehiclesStore, 'syncOdometer').mockResolvedValue()
  vi.spyOn(useMaintenanceStore(), 'create').mockResolvedValue({} as any)
}

describe('ImportPage — runImport odometer entries', () => {

  it('creates one odometer entry per unique date', async () => {
    baseSetup()
    const { createSpy } = setupOdometerMocks()

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })
    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([
      { odometer_km: 10000, record_date: '2024-01-01' },
      { odometer_km: 20000, record_date: '2024-02-01' },
      { odometer_km: 30000, record_date: '2024-03-01' },
    ])

    await wrapper.vm.runImport()

    expect(createSpy).toHaveBeenCalledTimes(3)
  })

  it('uses the highest km when two rows share the same date', async () => {
    baseSetup()
    const { createSpy } = setupOdometerMocks()

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })
    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([
      { odometer_km: 10000, record_date: '2024-01-01' },
      { odometer_km: 20000, record_date: '2024-01-01' },
    ])

    await wrapper.vm.runImport()

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reading_km: 20000, reading_date: '2024-01-01' }),
    )
  })

  it('skips dates that already exist in the odometer store', async () => {
    baseSetup()
    const { createSpy } = setupOdometerMocks([
      { reading_date: '2024-01-01', reading_km: 10000, vehicle_id: 'v1' },
    ])

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })
    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([
      { odometer_km: 10000, record_date: '2024-01-01' }, // already exists
      { odometer_km: 20000, record_date: '2024-02-01' }, // new
    ])

    await wrapper.vm.runImport()

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reading_date: '2024-02-01' }),
    )
  })

  it('does not create odometer entries for rows with null km', async () => {
    baseSetup()
    const { createSpy } = setupOdometerMocks()

    const wrapper = mount(ImportPage, { global: { plugins: [i18n], stubs } })
    wrapper.vm.selectedVehicleId = 'v1'
    wrapper.vm.importResult = makeImportResult([
      { odometer_km: null, record_date: '2024-01-01' },
      { odometer_km: null, record_date: '2024-02-01' },
    ])

    await wrapper.vm.runImport()

    expect(createSpy).not.toHaveBeenCalled()
  })
})
