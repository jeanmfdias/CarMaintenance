<template>
  <div>
    <!-- Header -->
    <div class="d-flex align-center mb-4">
      <v-btn icon variant="text" :to="{ name: 'vehicle-list' }">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <div class="ml-2">
        <h1 class="text-h5">{{ vehicle ? `${vehicle.make} ${vehicle.model}` : '' }}</h1>
        <div v-if="vehicle" class="text-caption text-medium-emphasis">
          {{ vehicle.manufacture_year }} · {{ t(`vehicles.fuelTypes.${vehicle.fuel_type}`) }}
          · {{ vehicle.current_odometer.toLocaleString() }} km
        </div>
      </div>
      <v-spacer />
      <v-btn
        v-if="vehicle"
        variant="text"
        prepend-icon="mdi-pencil-outline"
        :to="{ name: 'vehicle-edit', params: { id: vehicle.id } }"
      >
        {{ t('vehicles.actions.edit') }}
      </v-btn>
    </div>

    <v-alert v-if="!vehicle && !store.loading" type="warning" variant="tonal">
      Vehicle not found.
    </v-alert>

    <template v-if="vehicle">
      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="overview">{{ t('vehicleDetail.tabs.overview') }}</v-tab>
        <v-tab value="maintenance">{{ t('vehicleDetail.tabs.maintenance') }}</v-tab>
        <v-tab value="fuel">{{ t('vehicleDetail.tabs.fuel') }}</v-tab>
        <v-tab value="odometer">{{ t('vehicleDetail.tabs.odometer') }}</v-tab>
        <v-tab value="insurance">{{ t('vehicleDetail.tabs.insurance') }}</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="overview">
          <OverviewTab :vehicle-id="vehicleId" :vehicle="vehicle" />
        </v-window-item>
        <v-window-item value="maintenance">
          <MaintenanceTab :vehicle-id="vehicleId" />
        </v-window-item>
        <v-window-item value="fuel">
          <FuelTab :vehicle-id="vehicleId" />
        </v-window-item>
        <v-window-item value="odometer">
          <OdometerTab :vehicle-id="vehicleId" />
        </v-window-item>
        <v-window-item value="insurance">
          <InsuranceTab :vehicle-id="vehicleId" />
        </v-window-item>
      </v-window>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useVehiclesStore } from '@/stores/vehicles.store'
import OverviewTab from '@/components/vehicles/OverviewTab.vue'
import MaintenanceTab from '@/components/maintenance/MaintenanceTab.vue'
import FuelTab from '@/components/fuel/FuelTab.vue'
import OdometerTab from '@/components/odometer/OdometerTab.vue'
import InsuranceTab from '@/components/insurance/InsuranceTab.vue'

const { t } = useI18n()
const route = useRoute()
const store = useVehiclesStore()

const tab = ref('overview')
const vehicleId = computed(() => route.params.id as string)
const vehicle = computed(() => store.vehicles.find((v) => v.id === vehicleId.value))

onMounted(() => {
  if (store.vehicles.length === 0) store.fetchAll()
})
</script>
