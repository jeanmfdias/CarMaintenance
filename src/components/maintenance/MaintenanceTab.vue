<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <span class="text-body-2 text-medium-emphasis">
        {{ store.records.length }} {{ t('maintenance.recordCount') }}
      </span>
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
        {{ t('maintenance.addRecord') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <EmptyState
      v-if="!store.loading && store.records.length === 0"
      :message="t('maintenance.noRecords')"
      icon="mdi-wrench-clock"
    >
      <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('maintenance.addRecord') }}
      </v-btn>
    </EmptyState>

    <template v-else>
      <div v-for="group in groupedRecords" :key="group.month">
        <v-list-subheader>{{ formatMonth(group.month) }}</v-list-subheader>
        <v-list lines="two" class="mb-2">
          <v-list-item
            v-for="record in group.records"
            :key="record.id"
            :prepend-icon="CATEGORY_ICONS[record.category]"
          >
            <v-list-item-title>
              {{ t(`maintenance.categories.${record.category}`) }}
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ record.record_date }}
              <template v-if="record.odometer_km"> · {{ record.odometer_km.toLocaleString() }} km</template>
            </v-list-item-subtitle>
            <template #append>
              <div class="d-flex align-center gap-2">
                <div class="text-body-2 font-weight-medium">
                  {{ formatCurrency(record.total_cost) }}
                </div>
                <v-chip
                  v-if="record.next_service_date"
                  size="x-small"
                  :color="nextServiceColor(record.next_service_date)"
                  label
                >
                  {{ record.next_service_date }}
                </v-chip>
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
                      @click="openEdit(record)"
                    />
                    <v-list-item
                      prepend-icon="mdi-delete-outline"
                      :title="t('common.delete')"
                      base-color="error"
                      @click="openDelete(record)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </div>
    </template>

    <MaintenanceFormDialog
      v-model="formDialog"
      :vehicle-id="vehicleId"
      :record="editRecord"
    />

    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('maintenance.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { CATEGORY_ICONS } from '@/utils/maintenanceCategories'
import MaintenanceFormDialog from './MaintenanceFormDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { MaintenanceRecord } from '@/types'

const props = defineProps<{ vehicleId: string }>()

const { t } = useI18n()
const store = useMaintenanceStore()

const formDialog = ref(false)
const deleteDialog = ref(false)
const editRecord = ref<MaintenanceRecord | null>(null)
const deleteTarget = ref<MaintenanceRecord | null>(null)

onMounted(() => store.fetchByVehicle(props.vehicleId))

const groupedRecords = computed(() => {
  const map = new Map<string, MaintenanceRecord[]>()
  for (const r of store.records) {
    const month = r.record_date.substring(0, 7)
    if (!map.has(month)) map.set(month, [])
    map.get(month)!.push(r)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, records]) => ({ month, records }))
})

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function nextServiceColor(date: string): string {
  const days = Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
  if (days < 0) return 'error'
  if (days <= 30) return 'warning'
  return 'success'
}

function openCreate() {
  editRecord.value = null
  formDialog.value = true
}

function openEdit(record: MaintenanceRecord) {
  editRecord.value = record
  formDialog.value = true
}

function openDelete(record: MaintenanceRecord) {
  deleteTarget.value = record
  deleteDialog.value = true
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await store.remove(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>
