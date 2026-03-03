<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon variant="text" :to="{ name: 'vehicle-list' }">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h5 ml-2">
        {{ vehicle ? `${vehicle.make} ${vehicle.model}` : '' }}
      </h1>
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

    <v-alert v-if="!vehicle" type="warning" variant="tonal">
      Vehicle not found.
    </v-alert>

    <template v-else>
      <v-card class="mb-4">
        <v-card-text>
          <v-row dense>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.make') }}</div>
              <div class="text-body-2">{{ vehicle.make }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.model') }}</div>
              <div class="text-body-2">{{ vehicle.model }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.manufactureYear') }}</div>
              <div class="text-body-2">{{ vehicle.manufacture_year }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.modelYear') }}</div>
              <div class="text-body-2">{{ vehicle.model_year }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.fuelType') }}</div>
              <div class="text-body-2">{{ t(`vehicles.fuelTypes.${vehicle.fuel_type}`) }}</div>
            </v-col>
            <v-col cols="6" sm="3">
              <div class="text-caption text-medium-emphasis">{{ t('vehicles.fields.currentOdometer') }}</div>
              <div class="text-body-2">{{ vehicle.current_odometer.toLocaleString() }} km</div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-alert type="info" variant="tonal">
        Maintenance records, fuel log, insurance, and odometer history will appear here in Phase 2.
      </v-alert>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useVehiclesStore } from '@/stores/vehicles.store'

const { t } = useI18n()
const route = useRoute()
const store = useVehiclesStore()

const vehicle = computed(() => store.vehicles.find((v) => v.id === (route.params.id as string)))

onMounted(() => {
  if (store.vehicles.length === 0) store.fetchAll()
})
</script>
