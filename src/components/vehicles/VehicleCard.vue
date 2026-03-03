<template>
  <v-card :opacity="archived ? 0.7 : 1">
    <v-img
      v-if="photoUrl"
      :src="photoUrl"
      height="160"
      cover
      class="bg-grey-lighten-3"
    >
      <template #placeholder>
        <div class="d-flex align-center justify-center fill-height">
          <v-progress-circular indeterminate color="grey" />
        </div>
      </template>
    </v-img>
    <div v-else class="d-flex align-center justify-center bg-grey-lighten-3" style="height: 160px">
      <v-icon size="64" color="grey-lighten-1">mdi-car</v-icon>
    </div>

    <v-card-item>
      <v-card-title class="text-body-1 font-weight-bold">
        {{ vehicle.make }} {{ vehicle.model }}
      </v-card-title>
      <v-card-subtitle>
        {{ vehicle.manufacture_year }} · {{ vehicle.model_year }}
      </v-card-subtitle>
      <template #append>
        <v-menu>
          <template #activator="{ props }">
            <v-btn icon variant="text" size="small" v-bind="props">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-eye-outline"
              :title="t('vehicles.actions.viewDetails')"
              :to="{ name: 'vehicle-detail', params: { id: vehicle.id } }"
            />
            <v-list-item
              v-if="!archived"
              prepend-icon="mdi-pencil-outline"
              :title="t('vehicles.actions.edit')"
              :to="{ name: 'vehicle-edit', params: { id: vehicle.id } }"
            />
            <v-list-item
              v-if="!archived"
              prepend-icon="mdi-archive-outline"
              :title="t('vehicles.actions.archive')"
              @click="emit('archive', vehicle)"
            />
            <v-divider />
            <v-list-item
              prepend-icon="mdi-delete-outline"
              :title="t('vehicles.actions.delete')"
              base-color="error"
              @click="emit('delete', vehicle)"
            />
          </v-list>
        </v-menu>
      </template>
    </v-card-item>

    <v-card-text class="pt-0">
      <div class="d-flex align-center gap-2">
        <v-chip size="small" :color="fuelChipColor" label>
          {{ t(`vehicles.fuelTypes.${vehicle.fuel_type}`) }}
        </v-chip>
        <span class="text-body-2 text-medium-emphasis">
          {{ vehicle.current_odometer.toLocaleString() }} {{ t('common.km') }}
        </span>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVehiclesStore } from '@/stores/vehicles.store'
import type { Vehicle } from '@/types'

const props = defineProps<{
  vehicle: Vehicle
  archived?: boolean
}>()

const emit = defineEmits<{
  (e: 'archive', vehicle: Vehicle): void
  (e: 'delete', vehicle: Vehicle): void
}>()

const { t } = useI18n()
const store = useVehiclesStore()
const photoUrl = ref<string | null>(null)

const FUEL_COLORS: Record<string, string> = {
  gasoline: 'orange',
  diesel: 'grey',
  ethanol: 'green',
  flex: 'blue',
  electric: 'teal',
  hybrid: 'purple',
}

const fuelChipColor = computed(() => FUEL_COLORS[props.vehicle.fuel_type] ?? 'grey')

onMounted(async () => {
  if (props.vehicle.photo_url) {
    try {
      photoUrl.value = await store.getPhotoUrl(props.vehicle.photo_url)
    } catch {
      // photo unavailable — show placeholder
    }
  }
})
</script>
