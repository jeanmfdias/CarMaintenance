<template>
  <div>
    <h1 class="text-h5 mb-4">{{ t('dashboard.globalTitle') }}</h1>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Summary stats -->
    <v-row class="mb-6">
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="primary">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.totalCost') }}</div>
            <div class="text-h6 font-weight-bold mt-1">{{ formatCurrency(grandTotal) }}</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="3">
        <v-card variant="tonal" color="secondary">
          <v-card-text class="text-center">
            <div class="text-caption text-medium-emphasis">{{ t('dashboard.vehicles') }}</div>
            <div class="text-h6 font-weight-bold mt-1">{{ vehiclesStore.vehicles.length }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Cost per vehicle bar chart -->
    <v-card v-if="vehiclesStore.vehicles.length > 0" class="mb-6">
      <v-card-title class="text-body-1">{{ t('dashboard.costByVehicle') }}</v-card-title>
      <v-card-text>
        <Bar :data="vehicleBarData" :options="barOptions" />
      </v-card-text>
    </v-card>

    <!-- Upcoming maintenance across all vehicles -->
    <v-card>
      <v-card-title class="text-body-1">{{ t('dashboard.upcomingMaintenance') }}</v-card-title>
      <v-card-text>
        <EmptyState
          v-if="allUpcoming.length === 0"
          :message="t('dashboard.noUpcoming')"
          icon="mdi-check-circle-outline"
        />
        <v-list v-else lines="two" density="compact">
          <v-list-item
            v-for="item in allUpcoming"
            :key="item.record.id"
            :prepend-icon="CATEGORY_ICONS[item.record.category]"
            :to="{ name: 'vehicle-detail', params: { id: item.vehicleId } }"
          >
            <v-list-item-title>
              {{ item.vehicleName }} — {{ t(`maintenance.categories.${item.record.category}`) }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ nextServiceLabel(item) }}</v-list-item-subtitle>
            <template #append>
              <v-chip :color="nextServiceColor(item)" size="small" label>
                {{ nextServiceLabel(item) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Bar } from 'vue-chartjs'
import { useVehiclesStore } from '@/stores/vehicles.store'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useFuelStore } from '@/stores/fuel.store'
import { CATEGORY_ICONS } from '@/utils/maintenanceCategories'
import { formatCurrency, formatKm } from '@/utils/format'
import EmptyState from '@/components/common/EmptyState.vue'
import type { MaintenanceRecord } from '@/types'

const { t } = useI18n()
const vehiclesStore = useVehiclesStore()
const maintenanceStore = useMaintenanceStore()
const fuelStore = useFuelStore()

const loading = ref(false)

// Per-vehicle data maps: vehicleId → records/fillups
const maintenanceByVehicle = ref<Record<string, typeof maintenanceStore.records>>({})
const fuelByVehicle = ref<Record<string, typeof fuelStore.fillups>>({})

onMounted(async () => {
  loading.value = true
  if (vehiclesStore.vehicles.length === 0) await vehiclesStore.fetchAll()

  // Fetch data for all vehicles in parallel via the API client.
  const { api } = await import('@/lib/api')
  await Promise.all(
    vehiclesStore.vehicles.map(async (v) => {
      const [records, fillups] = await Promise.all([
        api.maintenance.listByVehicle(v.id),
        api.fuel.listByVehicle(v.id),
      ])
      maintenanceByVehicle.value[v.id] = records as typeof maintenanceStore.records
      fuelByVehicle.value[v.id] = fillups as typeof fuelStore.fillups
    }),
  )
  loading.value = false
})

const grandTotal = computed(() => {
  let total = 0
  for (const records of Object.values(maintenanceByVehicle.value)) {
    total += records.reduce((s, r) => s + r.total_cost, 0)
  }
  for (const fillups of Object.values(fuelByVehicle.value)) {
    total += fillups.reduce((s, f) => s + f.total_cost, 0)
  }
  return total
})

const vehicleBarData = computed(() => {
  const labels = vehiclesStore.vehicles.map((v) => `${v.make} ${v.model}`)
  const mainData = vehiclesStore.vehicles.map((v) =>
    (maintenanceByVehicle.value[v.id] ?? []).reduce((s, r) => s + r.total_cost, 0),
  )
  const fuelData = vehiclesStore.vehicles.map((v) =>
    (fuelByVehicle.value[v.id] ?? []).reduce((s, f) => s + f.total_cost, 0),
  )
  return {
    labels,
    datasets: [
      { label: t('maintenance.title'), data: mainData, backgroundColor: '#1565C0', stack: 'a' },
      { label: t('fuel.title'), data: fuelData, backgroundColor: '#FF6F00', stack: 'a' },
    ],
  }
})

const barOptions = {
  responsive: true,
  plugins: { legend: { position: 'top' as const } },
  scales: { x: { stacked: true }, y: { stacked: true } },
}

type UpcomingItem = {
  record: MaintenanceRecord
  vehicleId: string
  vehicleName: string
  currentOdometer: number
}

const allUpcoming = computed(() => {
  const items: UpcomingItem[] = []
  for (const v of vehiclesStore.vehicles) {
    const records = maintenanceByVehicle.value[v.id] ?? []
    for (const r of records) {
      if (isUpcoming(r, v.current_odometer)) {
        items.push({
          record: r,
          vehicleId: v.id,
          vehicleName: `${v.make} ${v.model}`,
          currentOdometer: v.current_odometer,
        })
      }
    }
  }
  return items.sort(compareUpcoming)
})

function isUpcoming(record: MaintenanceRecord, currentOdometer: number): boolean {
  if (record.next_service_km != null) {
    return kmUntilService(record, currentOdometer) <= (record.reminder_lead_km ?? 1000)
  }
  if (record.next_service_date) {
    return daysUntil(record.next_service_date) <= record.reminder_lead_days
  }
  return false
}

function daysUntil(date: string): number {
  return Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

function kmUntilService(record: MaintenanceRecord, currentOdometer: number): number {
  return (record.next_service_km ?? 0) - currentOdometer
}

function compareUpcoming(a: UpcomingItem, b: UpcomingItem): number {
  if (a.record.next_service_km != null && b.record.next_service_km != null) {
    return kmUntilService(a.record, a.currentOdometer) - kmUntilService(b.record, b.currentOdometer)
  }
  if (a.record.next_service_km != null) return -1
  if (b.record.next_service_km != null) return 1
  return (a.record.next_service_date ?? '').localeCompare(b.record.next_service_date ?? '')
}

function nextServiceColor(item: UpcomingItem): string {
  if (item.record.next_service_km != null) {
    return kmUntilService(item.record, item.currentOdometer) < 0 ? 'error' : 'warning'
  }
  if (!item.record.next_service_date) return 'success'
  const days = daysUntil(item.record.next_service_date)
  if (days < 0) return 'error'
  if (days <= 30) return 'warning'
  return 'success'
}

function nextServiceLabel(item: UpcomingItem): string {
  if (item.record.next_service_km != null) {
    const km = Math.max(kmUntilService(item.record, item.currentOdometer), 0)
    return `${formatKm(km)} km`
  }
  return item.record.next_service_date ?? ''
}
</script>
