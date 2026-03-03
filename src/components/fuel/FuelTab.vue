<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <div v-if="avgEfficiency" class="d-flex align-center gap-2">
        <v-chip color="primary" variant="tonal" prepend-icon="mdi-fuel">
          {{ t('fuel.efficiency.average') }}: {{ avgEfficiency.toFixed(2) }} km/L
        </v-chip>
      </div>
      <span v-else />
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
        {{ t('fuel.addFillup') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <EmptyState
      v-if="!store.loading && store.fillups.length === 0"
      :message="t('fuel.noFillups')"
      icon="mdi-gas-station-off"
    >
      <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('fuel.addFillup') }}
      </v-btn>
    </EmptyState>

    <v-list v-else lines="two">
      <v-list-item
        v-for="item in displayList"
        :key="item.fillup.id"
        prepend-icon="mdi-gas-station"
      >
        <v-list-item-title>
          {{ item.fillup.fillup_date }}
          <v-chip
            v-if="item.fillup.fuel_type"
            size="x-small"
            class="ml-2"
            label
          >
            {{ t(`vehicles.fuelTypes.${item.fillup.fuel_type}`) }}
          </v-chip>
          <v-chip v-if="item.fillup.full_tank" size="x-small" color="teal" variant="tonal" class="ml-1" label>
            {{ t('fuel.fields.fullTank') }}
          </v-chip>
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ item.fillup.liters.toFixed(3) }} L · {{ formatCurrency(item.fillup.total_cost) }}
          · {{ item.fillup.price_per_liter.toFixed(4) }} R$/L
          · {{ item.fillup.odometer_km.toLocaleString() }} km
        </v-list-item-subtitle>
        <template #append>
          <div class="d-flex align-center gap-2">
            <v-chip
              v-if="item.efficiency"
              size="small"
              color="green"
              variant="tonal"
              label
            >
              {{ item.efficiency.kmPerLiter.toFixed(2) }} km/L
            </v-chip>
            <span v-else class="text-caption text-medium-emphasis">—</span>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn icon variant="text" size="x-small" v-bind="menuProps">
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  :title="t('common.edit')"
                  @click="openEdit(item.fillup)"
                />
                <v-list-item
                  prepend-icon="mdi-delete-outline"
                  :title="t('common.delete')"
                  base-color="error"
                  @click="openDelete(item.fillup)"
                />
              </v-list>
            </v-menu>
          </div>
        </template>
      </v-list-item>
    </v-list>

    <FuelFormDialog
      v-model="formDialog"
      :vehicle-id="vehicleId"
      :record="editRecord"
    />

    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('fuel.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFuelStore } from '@/stores/fuel.store'
import { useFuelEfficiency } from '@/composables/useFuelEfficiency'
import FuelFormDialog from './FuelFormDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { FuelFillup } from '@/types'

const props = defineProps<{ vehicleId: string }>()

const { t } = useI18n()
const store = useFuelStore()

const formDialog = ref(false)
const deleteDialog = ref(false)
const editRecord = ref<FuelFillup | null>(null)
const deleteTarget = ref<FuelFillup | null>(null)

onMounted(() => store.fetchByVehicle(props.vehicleId))

const fillupsRef = computed(() => store.fillups)
const efficiencyList = useFuelEfficiency(fillupsRef)

// Display newest first
const displayList = computed(() => [...efficiencyList.value].reverse())

const avgEfficiency = computed(() => {
  const values = efficiencyList.value
    .map((e) => e.efficiency?.kmPerLiter)
    .filter((v): v is number => v !== null && v !== undefined)
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
})

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function openCreate() {
  editRecord.value = null
  formDialog.value = true
}

function openEdit(fillup: FuelFillup) {
  editRecord.value = fillup
  formDialog.value = true
}

function openDelete(fillup: FuelFillup) {
  deleteTarget.value = fillup
  deleteDialog.value = true
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await store.remove(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>
