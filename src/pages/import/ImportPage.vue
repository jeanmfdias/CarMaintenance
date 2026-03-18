<template>
  <v-container class="pa-0" style="max-width: 900px">
    <div class="mb-6">
      <h1 class="text-h5 font-weight-bold">{{ t('importLegacy.title') }}</h1>
      <p class="text-body-2 text-medium-emphasis mt-1">{{ t('importLegacy.subtitle') }}</p>
    </div>

    <v-card>
      <v-card-text class="pa-6">
        <!-- Step 1: Vehicle selector -->
        <v-select
          v-model="selectedVehicleId"
          :items="vehicleItems"
          item-title="label"
          item-value="id"
          :label="t('importLegacy.selectVehicle')"
          :loading="vehiclesStore.loading"
          prepend-inner-icon="mdi-car"
          variant="outlined"
          class="mb-4"
        />

        <!-- Step 2: File picker -->
        <div v-if="selectedVehicleId" class="mb-4">
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="d-none"
            @change="onFileChange"
          />

          <div v-if="!selectedFile" class="d-flex align-center gap-3">
            <v-btn
              variant="outlined"
              prepend-icon="mdi-file-upload-outline"
              @click="fileInput?.click()"
            >
              {{ t('importLegacy.selectFile') }}
            </v-btn>
            <span class="text-caption text-medium-emphasis">{{ t('importLegacy.instruction') }}</span>
          </div>

          <div v-else class="d-flex align-center gap-3">
            <v-chip
              prepend-icon="mdi-file-delimited-outline"
              closable
              @click:close="clearFile"
            >
              {{ selectedFile.name }}
            </v-chip>
            <span class="text-caption text-medium-emphasis">
              {{ t('importLegacy.validTypes') }}
            </span>
          </div>
        </div>

        <!-- Step 3: Preview -->
        <template v-if="importResult">
          <v-alert
            :type="importResult.errors.length > 0 ? 'warning' : 'success'"
            variant="tonal"
            class="mb-4"
            density="compact"
          >
            {{ t('importLegacy.summary', { valid: importResult.valid.length, errors: importResult.errors.length }) }}
          </v-alert>

          <v-alert
            v-if="importResult.valid.length === 0"
            type="error"
            variant="tonal"
            class="mb-4"
            density="compact"
          >
            {{ t('importLegacy.noValidRows') }}
          </v-alert>

          <v-table v-if="allRows.length > 0" density="compact" class="mb-4">
            <thead>
              <tr>
                <th scope="col">{{ t('importLegacy.colRow') }}</th>
                <th scope="col">{{ t('importLegacy.colDate') }}</th>
                <th scope="col">{{ t('importLegacy.colType') }}</th>
                <th scope="col">{{ t('importLegacy.colDescription') }}</th>
                <th scope="col">{{ t('importLegacy.colKm') }}</th>
                <th scope="col">{{ t('importLegacy.colValue') }}</th>
                <th scope="col">{{ t('importLegacy.colStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in allRows"
                :key="row.rowNumber"
                :class="row.error ? 'text-error' : ''"
              >
                <td>{{ row.rowNumber }}</td>
                <td>{{ row.date }}</td>
                <td>{{ row.type }}</td>
                <td>{{ row.description }}</td>
                <td>{{ row.km }}</td>
                <td>{{ row.value }}</td>
                <td>
                  <span v-if="row.error" class="text-caption">{{ row.error }}</span>
                  <v-icon v-else color="success" size="small">mdi-check</v-icon>
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>

      <v-card-actions class="px-6 pb-6 pt-0">
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canImport"
          :loading="importing"
          prepend-icon="mdi-database-import-outline"
          @click="runImport"
        >
          {{ t('importLegacy.importBtn', { count: importResult?.valid.length ?? 0 }) }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useSettingsStore } from '@/stores/settings.store'
import { showSnackbar } from '@/composables/useSnackbar'
import { parseMaintenanceCsv } from '@/utils/importData'
import type { ImportResult, ImportError } from '@/utils/importData'

const { t } = useI18n()
const vehiclesStore = useVehiclesStore()
const maintenanceStore = useMaintenanceStore()
const settingsStore = useSettingsStore()

const selectedVehicleId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const importResult = ref<ImportResult | null>(null)
const importing = ref(false)

const vehicleItems = computed(() =>
  vehiclesStore.vehicles
    .filter(v => !v.sell_date)
    .map(v => ({ id: v.id, label: `${v.make} ${v.model} (${v.manufacture_year})` }))
)

interface PreviewRow {
  rowNumber: number
  date: string
  type: string
  description: string
  km: string
  value: string
  error: string | null
}

const allRows = computed<PreviewRow[]>(() => {
  if (!importResult.value) return []

  const rows: PreviewRow[] = []

  importResult.value.valid.forEach((rec, i) => {
    rows.push({
      rowNumber: i + 2, // header is row 1
      date: rec.record_date,
      type: rec.category,
      description: rec.notes,
      km: rec.odometer_km == null ? '' : String(rec.odometer_km),
      value: rec.total_cost.toFixed(2),
      error: null,
    })
  })

  importResult.value.errors.forEach((err: ImportError) => {
    rows.push({
      rowNumber: err.row,
      date: err.raw.date,
      type: err.raw.type,
      description: err.raw.description,
      km: err.raw.km,
      value: err.raw.value,
      error: err.message,
    })
  })

  rows.sort((a, b) => a.rowNumber - b.rowNumber)
  return rows
})

const canImport = computed(
  () => selectedVehicleId.value && importResult.value && importResult.value.valid.length > 0 && !importing.value
)

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedFile.value = file
  const text = await file.text()
  importResult.value = parseMaintenanceCsv(text)
  // Reset input so the same file can be re-selected after clearing
  input.value = ''
}

function clearFile() {
  selectedFile.value = null
  importResult.value = null
}

async function runImport() {
  if (!selectedVehicleId.value || !importResult.value) return
  importing.value = true

  const vehicleId = selectedVehicleId.value
  const reminderDays = settingsStore.settings?.default_reminder_lead_days ?? 30
  const records = importResult.value.valid

  try {
    for (const rec of records) {
      await maintenanceStore.create({
        vehicle_id: vehicleId,
        service_provider_id: null,
        category: rec.category,
        record_date: rec.record_date,
        odometer_km: rec.odometer_km,
        total_cost: rec.total_cost,
        labor_cost: null,
        parts_cost: null,
        notes: rec.notes || null,
        next_service_date: null,
        next_service_km: null,
        reminder_lead_days: reminderDays,
      })
    }
    showSnackbar(t('importLegacy.success', { count: records.length }), 'success')
    clearFile()
    selectedVehicleId.value = null
  } catch {
    showSnackbar(t('common.error'), 'error')
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  if (!vehiclesStore.vehicles.length) await vehiclesStore.fetchAll()
  if (!settingsStore.settings) await settingsStore.fetch()
})
</script>
