<template>
  <div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Stat Cards -->
    <v-row class="mb-6">
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="primary">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.totalMaintenanceCost') }}</div>
            <div class="text-h6 font-weight-bold mt-1">{{ formatCurrency(totalMaintenanceCost) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="secondary">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.totalFuelCost') }}</div>
            <div class="text-h6 font-weight-bold mt-1">{{ formatCurrency(totalFuelCost) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="success">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.costPerKm') }}</div>
            <div class="text-h6 font-weight-bold mt-1">
              {{ costPerKm ? `R$ ${costPerKm.toFixed(2)}` : t('common.notAvailable') }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="teal">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.avgEfficiency') }}</div>
            <div class="text-h6 font-weight-bold mt-1">
              {{ avgEfficiency ? `${avgEfficiency.toFixed(2)} km/L` : t('common.notAvailable') }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Cost Breakdown Pie -->
      <v-col cols="12" md="5">
        <v-card>
          <v-card-title class="text-body-1">{{ t('dashboard.costBreakdown') }}</v-card-title>
          <v-card-text>
            <div v-if="(pieData.datasets[0]?.data.length ?? 0) > 0" style="max-height: 260px">
              <Pie :data="pieData" :options="pieOptions" />
            </div>
            <EmptyState v-else :message="t('common.noData')" icon="mdi-chart-pie-outline" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Cost Over Time Bar -->
      <v-col cols="12" md="7">
        <v-card>
          <v-card-title class="text-body-1">{{ t('dashboard.costOverTime') }}</v-card-title>
          <v-card-text>
            <Bar :data="barData" :options="barOptions" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Fuel Efficiency Line -->
      <v-col v-if="(lineData.datasets[0]?.data.length ?? 0) > 0" cols="12">
        <v-card>
          <v-card-title class="text-body-1">{{ t('dashboard.fuelEfficiency') }}</v-card-title>
          <v-card-text>
            <Line :data="lineData" :options="lineOptions" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Upcoming Maintenance -->
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-body-1">{{ t('dashboard.upcomingMaintenance') }}</v-card-title>
          <v-card-text>
            <EmptyState
              v-if="upcomingMaintenance.length === 0"
              :message="t('dashboard.noUpcoming')"
              icon="mdi-check-circle-outline"
            />
            <v-list v-else lines="one" density="compact">
              <v-list-item
                v-for="record in upcomingMaintenance"
                :key="record.id"
                :prepend-icon="CATEGORY_ICONS[record.category]"
              >
                <v-list-item-title>
                  {{ t(`maintenance.categories.${record.category}`) }}
                  <span v-if="record.notes" class="text-caption text-medium-emphasis ml-2">
                    {{ truncateNotes(record.notes) }}
                  </span>
                </v-list-item-title>
                <template #append>
                  <div class="d-flex align-center gap-2">
                    <v-chip
                      :color="nextServiceColor(record)"
                      size="small"
                      label
                    >
                      {{ nextServiceLabel(record) }}
                    </v-chip>
                    <v-btn
                      variant="text"
                      size="small"
                      prepend-icon="mdi-open-in-new"
                      @click="openMaintenance(record)"
                    >
                      {{ t('maintenance.openRecord') }}
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Export actions -->
    <div class="d-flex gap-3 mt-4">
      <v-btn variant="outlined" prepend-icon="mdi-file-delimited-outline" @click="doExportCsv">
        {{ t('export.exportCsv') }}
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-file-pdf-box" @click="doExportPdf">
        {{ t('export.exportPdf') }}
      </v-btn>
    </div>

    <MaintenanceFormDialog
      v-model="maintenanceDialog"
      :vehicle-id="vehicleId"
      :record="selectedMaintenance"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pie, Bar, Line } from 'vue-chartjs'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useFuelStore } from '@/stores/fuel.store'
import { useInsuranceStore } from '@/stores/insurance.store'
import { useOdometerStore } from '@/stores/odometer.store'
import { useFuelEfficiency } from '@/composables/useFuelEfficiency'
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/utils/maintenanceCategories'
import { exportMaintenanceCsv, exportVehicleReport } from '@/utils/exportData'
import { formatCurrency, formatKm, formatMonthShort } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'
import MaintenanceFormDialog from '@/components/maintenance/MaintenanceFormDialog.vue'
import type { Vehicle, MaintenanceCategory, MaintenanceRecord } from '@/types'

const props = defineProps<{ vehicleId: string; vehicle: Vehicle }>()

const { t } = useI18n()
const maintenanceStore = useMaintenanceStore()
const fuelStore = useFuelStore()
const insuranceStore = useInsuranceStore()
const odometerStore = useOdometerStore()

const loading = ref(false)
const maintenanceDialog = ref(false)
const selectedMaintenance = ref<MaintenanceRecord | null>(null)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    maintenanceStore.fetchByVehicle(props.vehicleId),
    fuelStore.fetchByVehicle(props.vehicleId),
    insuranceStore.fetchByVehicle(props.vehicleId),
    odometerStore.fetchByVehicle(props.vehicleId),
  ])
  loading.value = false
})

const fillupsRef = computed(() => fuelStore.fillups)
const efficiencyList = useFuelEfficiency(fillupsRef)

// ── Stats ──────────────────────────────────────────────────────────────────
const totalMaintenanceCost = computed(() =>
  maintenanceStore.records.reduce((s, r) => s + r.total_cost, 0),
)
const totalFuelCost = computed(() =>
  fuelStore.fillups.reduce((s, f) => s + f.total_cost, 0),
)
const kmUsed = computed(() => {
  const readings = odometerStore.entries.map((e) => e.reading_km)
  if (readings.length < 2) return null
  return Math.max(...readings) - Math.min(...readings)
})
const costPerKm = computed(() => {
  const total = totalMaintenanceCost.value + totalFuelCost.value
  const km = kmUsed.value
  if (!total || !km) return null
  return total / km
})
const avgEfficiency = computed(() => {
  const vals = efficiencyList.value
    .map((e) => e.efficiency?.kmPerLiter)
    .filter((v): v is number => v !== undefined)
  if (!vals.length) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
})

// ── Upcoming Maintenance ──────────────────────────────────────────────────
const upcomingMaintenance = computed(() =>
  maintenanceStore.records
    .filter((r) => {
      if (r.next_service_km != null) {
        return kmUntilService(r) <= (r.reminder_lead_km ?? 1000)
      }
      if (r.next_service_date) {
        return daysUntil(r.next_service_date) <= r.reminder_lead_days
      }
      return false
    })
    .sort(compareUpcomingMaintenance),
)

function daysUntil(date: string): number {
  return Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

function kmUntilService(record: MaintenanceRecord): number {
  return (record.next_service_km ?? 0) - props.vehicle.current_odometer
}

function compareUpcomingMaintenance(a: MaintenanceRecord, b: MaintenanceRecord): number {
  if (a.next_service_km != null && b.next_service_km != null) {
    return kmUntilService(a) - kmUntilService(b)
  }
  if (a.next_service_km != null) return -1
  if (b.next_service_km != null) return 1
  return (a.next_service_date ?? '').localeCompare(b.next_service_date ?? '')
}

function nextServiceColor(record: MaintenanceRecord): string {
  if (record.next_service_km != null) {
    return kmUntilService(record) < 0 ? 'error' : 'warning'
  }
  if (!record.next_service_date) return 'success'
  const days = daysUntil(record.next_service_date)
  if (days < 0) return 'error'
  if (days <= 30) return 'warning'
  return 'success'
}

function nextServiceLabel(record: MaintenanceRecord): string {
  if (record.next_service_km != null) {
    const km = Math.max(kmUntilService(record), 0)
    return `${formatKm(km)} km`
  }
  return record.next_service_date ?? ''
}

function openMaintenance(record: MaintenanceRecord) {
  selectedMaintenance.value = record
  maintenanceDialog.value = true
}

function truncateNotes(notes: unknown): string {
  const text = String(notes ?? '')
  return text.length > 50 ? `${text.substring(0, 50)}...` : text
}

// ── Charts ────────────────────────────────────────────────────────────────
function getLast12Months(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

const pieData = computed(() => {
  const costByCategory: Partial<Record<MaintenanceCategory | 'fuel_total', number>> = {}
  for (const r of maintenanceStore.records) {
    costByCategory[r.category] = (costByCategory[r.category] ?? 0) + r.total_cost
  }
  if (totalFuelCost.value > 0) {
    costByCategory['fuel_total'] = totalFuelCost.value
  }
  const keys = Object.keys(costByCategory) as (MaintenanceCategory | 'fuel_total')[]
  return {
    labels: keys.map((k) =>
      k === 'fuel_total' ? t('fuel.title') : t(`maintenance.categories.${k}`),
    ),
    datasets: [
      {
        data: keys.map((k) => costByCategory[k] ?? 0),
        backgroundColor: keys.map((k) =>
          k === 'fuel_total' ? CATEGORY_COLORS['fuel'] : CATEGORY_COLORS[k as MaintenanceCategory],
        ),
      },
    ],
  }
})

const pieOptions = {
  responsive: true,
  plugins: { legend: { position: 'bottom' as const } },
}

const barData = computed(() => {
  const months = getLast12Months()
  const mainCosts: Record<string, number> = {}
  const fuelCosts: Record<string, number> = {}
  months.forEach((m) => { mainCosts[m] = 0; fuelCosts[m] = 0 })

  for (const r of maintenanceStore.records) {
    const m = r.record_date.substring(0, 7)
    if (m in mainCosts) mainCosts[m] = (mainCosts[m] ?? 0) + r.total_cost
  }
  for (const f of fuelStore.fillups) {
    const m = f.fillup_date.substring(0, 7)
    if (m in fuelCosts) fuelCosts[m] = (fuelCosts[m] ?? 0) + f.total_cost
  }

  return {
    labels: months.map((m) => formatMonthShort(`${m}-01`)),
    datasets: [
      { label: t('maintenance.title'), data: months.map((m) => mainCosts[m] ?? 0), backgroundColor: '#1565C0', stack: 'a' },
      { label: t('fuel.title'), data: months.map((m) => fuelCosts[m] ?? 0), backgroundColor: '#FF6F00', stack: 'a' },
    ],
  }
})

const barOptions = {
  responsive: true,
  plugins: { legend: { position: 'top' as const } },
  scales: { x: { stacked: true }, y: { stacked: true } },
}

const lineData = computed(() => {
  const points = efficiencyList.value.filter((e) => e.efficiency !== null)
  return {
    labels: points.map((e) => {
      const d = new Date(e.fillup.fillup_date)
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }),
    datasets: [
      {
        label: t('fuel.efficiency.kmPerLiter'),
        data: points.map((e) => e.efficiency!.kmPerLiter),
        borderColor: '#00695C',
        backgroundColor: 'rgba(0,105,92,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 4,
      },
    ],
  }
})

const lineOptions = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { title: { display: true, text: 'km/L' } } },
}

// ── Export ────────────────────────────────────────────────────────────────
function doExportCsv() {
  exportMaintenanceCsv(props.vehicle, maintenanceStore.records)
}

function doExportPdf() {
  exportVehicleReport(props.vehicle, maintenanceStore.records, fuelStore.fillups)
}
</script>
