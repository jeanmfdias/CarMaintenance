<template>
  <div>
    <div class="d-flex justify-end mb-4">
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreate">
        {{ t('insurance.addPolicy') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <EmptyState
      v-if="!store.loading && store.policies.length === 0"
      :message="t('insurance.noPolicies')"
      icon="mdi-shield-off-outline"
    >
      <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('insurance.addPolicy') }}
      </v-btn>
    </EmptyState>

    <v-row v-else>
      <v-col
        v-for="policy in store.policies"
        :key="policy.id"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title class="text-body-1 font-weight-bold">
              {{ policy.insurer }}
            </v-card-title>
            <v-card-subtitle v-if="policy.policy_number">
              {{ policy.policy_number }}
            </v-card-subtitle>
            <template #append>
              <v-chip
                :color="statusColor(policy)"
                size="small"
                label
              >
                {{ t(`insurance.status.${statusKey(policy)}`) }}
              </v-chip>
            </template>
          </v-card-item>
          <v-card-text class="pt-0">
            <div class="text-body-2">
              {{ policy.start_date }} → {{ policy.expiry_date }}
            </div>
            <div v-if="policy.annual_cost" class="text-body-2 mt-1">
              R$ {{ policy.annual_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }} / {{ t('insurance.perYear') }}
            </div>
            <div v-if="policy.notes" class="text-caption text-medium-emphasis mt-1">
              {{ policy.notes }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn variant="text" size="small" prepend-icon="mdi-pencil-outline" @click="openEdit(policy)">
              {{ t('common.edit') }}
            </v-btn>
            <v-btn variant="text" size="small" color="error" prepend-icon="mdi-delete-outline" @click="openDelete(policy)">
              {{ t('common.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <InsuranceFormDialog
      v-model="formDialog"
      :vehicle-id="vehicleId"
      :record="editRecord"
    />

    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('insurance.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInsuranceStore } from '@/stores/insurance.store'
import InsuranceFormDialog from './InsuranceFormDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { InsurancePolicy } from '@/types'

const props = defineProps<{ vehicleId: string }>()

const { t } = useI18n()
const store = useInsuranceStore()

const formDialog = ref(false)
const deleteDialog = ref(false)
const editRecord = ref<InsurancePolicy | null>(null)
const deleteTarget = ref<InsurancePolicy | null>(null)

onMounted(() => store.fetchByVehicle(props.vehicleId))

function daysUntil(date: string): number {
  return Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

function statusKey(policy: InsurancePolicy): string {
  const days = daysUntil(policy.expiry_date)
  if (days < 0) return 'expired'
  if (days <= policy.reminder_lead_days) return 'expiringSoon'
  return 'active'
}

function statusColor(policy: InsurancePolicy): string {
  const key = statusKey(policy)
  if (key === 'expired') return 'error'
  if (key === 'expiringSoon') return 'warning'
  return 'success'
}

function openCreate() {
  editRecord.value = null
  formDialog.value = true
}

function openEdit(policy: InsurancePolicy) {
  editRecord.value = policy
  formDialog.value = true
}

function openDelete(policy: InsurancePolicy) {
  deleteTarget.value = policy
  deleteDialog.value = true
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await store.remove(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>
