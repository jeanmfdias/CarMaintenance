<template>
  <div>
    <div class="d-flex justify-end mb-4">
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
        {{ t('odometer.addEntry') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <EmptyState
      v-if="!store.loading && store.entries.length === 0"
      :message="t('odometer.noEntries')"
      icon="mdi-counter"
    >
      <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('odometer.addEntry') }}
      </v-btn>
    </EmptyState>

    <v-list v-else lines="one">
      <v-list-item
        v-for="entry in store.entries"
        :key="entry.id"
        prepend-icon="mdi-counter"
      >
        <v-list-item-title>
          {{ entry.reading_km.toLocaleString() }} km
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ entry.reading_date }}
          <template v-if="entry.notes"> · {{ entry.notes }}</template>
        </v-list-item-subtitle>
        <template #append>
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
                @click="openEdit(entry)"
              />
              <v-list-item
                prepend-icon="mdi-delete-outline"
                :title="t('common.delete')"
                base-color="error"
                @click="openDelete(entry)"
              />
            </v-list>
          </v-menu>
        </template>
      </v-list-item>
    </v-list>

    <OdometerFormDialog
      v-model="formDialog"
      :vehicle-id="vehicleId"
      :record="editRecord"
    />

    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('odometer.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOdometerStore } from '@/stores/odometer.store'
import OdometerFormDialog from './OdometerFormDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { OdometerEntry } from '@/types'

const props = defineProps<{ vehicleId: string }>()

const { t } = useI18n()
const store = useOdometerStore()

const formDialog = ref(false)
const deleteDialog = ref(false)
const editRecord = ref<OdometerEntry | null>(null)
const deleteTarget = ref<OdometerEntry | null>(null)

onMounted(() => store.fetchByVehicle(props.vehicleId))

function openCreate() {
  editRecord.value = null
  formDialog.value = true
}

function openEdit(entry: OdometerEntry) {
  editRecord.value = entry
  formDialog.value = true
}

function openDelete(entry: OdometerEntry) {
  deleteTarget.value = entry
  deleteDialog.value = true
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await store.remove(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>
