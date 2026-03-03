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
            <v-list-item-subtitle>{{ item.record.next_service_date }}</v-list-item-subtitle>
            <template #append>
              <v-chip :color="nextServiceColor(item.record.next_service_date!)" size="small" label>
                {{ item.record.next_service_date }}
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
import EmptyState from '@/components/common/EmptyState.vue'

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

  // Fetch data for all vehicles in parallel
  await Promise.all(
    vehiclesStore.vehicles.map(async (v) => {
      // Use store fetch — stores hold last-fetched vehicle data
      // For global dashboard we re-query directly
      const { supabase } = await import('@/lib/supabase')
      const [mRes, fRes] = await Promise.all([
        supabase.from('maintenance_records').select('*').eq('vehicle_id', v.id),
        supabase.from('fuel_fillups').select('*').eq('vehicle_id', v.id),
      ])
      maintenanceByVehicle.value[v.id] = (mRes.data ?? []) as typeof maintenanceStore.records
      fuelByVehicle.value[v.id] = (fRes.data ?? []) as typeof fuelStore.fillups
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

const allUpcoming = computed(() => {
  const items: { record: (typeof maintenanceStore.records)[0]; vehicleId: string; vehicleName: string }[] = []
  for (const v of vehiclesStore.vehicles) {
    const records = maintenanceByVehicle.value[v.id] ?? []
    for (const r of records) {
      if (!r.next_service_date) continue
      const days = Math.floor(
        (new Date(r.next_service_date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
      )
      if (days <= 90) {
        items.push({ record: r, vehicleId: v.id, vehicleName: `${v.make} ${v.model}` })
      }
    }
  }
  return items.sort((a, b) => a.record.next_service_date!.localeCompare(b.record.next_service_date!))
})

function nextServiceColor(date: string): string {
  const days = Math.floor(
    (new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  )
  if (days < 0) return 'error'
  if (days <= 30) return 'warning'
  return 'success'
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>
