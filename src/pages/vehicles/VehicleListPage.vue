<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5">{{ t('vehicles.title') }}</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'vehicle-new' }">
        {{ t('vehicles.addVehicle') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="active">
        {{ t('vehicles.active') }} ({{ store.activeVehicles.length }})
      </v-tab>
      <v-tab value="archived">
        {{ t('vehicles.archived') }} ({{ store.archivedVehicles.length }})
      </v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="active">
        <EmptyState
          v-if="!store.loading && store.activeVehicles.length === 0"
          :message="t('vehicles.noVehicles')"
          icon="mdi-car-off"
        >
          <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" :to="{ name: 'vehicle-new' }">
            {{ t('vehicles.addVehicle') }}
          </v-btn>
        </EmptyState>
        <v-row v-else>
          <v-col
            v-for="vehicle in store.activeVehicles"
            :key="vehicle.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <VehicleCard :vehicle="vehicle" @archive="openArchive(vehicle)" @delete="openDelete(vehicle)" />
          </v-col>
        </v-row>
      </v-window-item>

      <v-window-item value="archived">
        <EmptyState
          v-if="store.archivedVehicles.length === 0"
          :message="t('vehicles.noArchivedVehicles')"
          icon="mdi-archive-outline"
        />
        <v-row v-else>
          <v-col
            v-for="vehicle in store.archivedVehicles"
            :key="vehicle.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <VehicleCard :vehicle="vehicle" archived @delete="openDelete(vehicle)" />
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

    <!-- Archive dialog -->
    <v-dialog v-model="archiveDialog" max-width="400">
      <v-card>
        <v-card-title>{{ t('vehicles.archiveTitle') }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-4">{{ t('vehicles.archiveMessage') }}</p>
          <v-text-field
            v-model="sellDate"
            :label="t('vehicles.fields.sellDate')"
            type="date"
          />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="archiveDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!sellDate" @click="confirmArchive">
            {{ t('vehicles.actions.archive') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('vehicles.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVehiclesStore } from '@/stores/vehicles.store'
import VehicleCard from '@/components/vehicles/VehicleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { Vehicle } from '@/types'

const { t } = useI18n()
const store = useVehiclesStore()

const tab = ref('active')
const deleteDialog = ref(false)
const archiveDialog = ref(false)
const sellDate = ref('')
const targetVehicle = ref<Vehicle | null>(null)

onMounted(() => store.fetchAll())

function openDelete(vehicle: Vehicle) {
  targetVehicle.value = vehicle
  deleteDialog.value = true
}

function openArchive(vehicle: Vehicle) {
  targetVehicle.value = vehicle
  sellDate.value = new Date().toISOString().slice(0, 10)
  archiveDialog.value = true
}

async function confirmDelete() {
  if (targetVehicle.value) {
    await store.remove(targetVehicle.value.id)
    targetVehicle.value = null
  }
}

async function confirmArchive() {
  if (targetVehicle.value && sellDate.value) {
    await store.archive(targetVehicle.value.id, sellDate.value)
    archiveDialog.value = false
    targetVehicle.value = null
  }
}
</script>
