<template>
  <v-dialog v-model="model" max-width="680" scrollable>
    <v-card>
      <v-card-title>
        {{ record ? t('maintenance.editRecord') : t('maintenance.addRecord') }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-row>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.category"
                :label="t('maintenance.fields.category')"
                :items="categoryItems"
                :rules="[required]"
              >
                <template #item="{ props: itemProps, item }">
                  <v-list-item v-bind="itemProps">
                    <template #prepend>
                      <v-icon :icon="CATEGORY_ICONS[item.value as MaintenanceCategory]" class="mr-2" />
                    </template>
                  </v-list-item>
                </template>
              </v-select>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.record_date"
                :label="t('maintenance.fields.date')"
                type="date"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.odometer_km"
                :label="t('maintenance.fields.odometer')"
                type="number"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.total_cost"
                :label="t('maintenance.fields.totalCost')"
                type="number"
                prefix="R$"
                :rules="[required, nonNegative]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.labor_cost"
                :label="t('maintenance.fields.laborCost')"
                type="number"
                prefix="R$"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.parts_cost"
                :label="t('maintenance.fields.partsCost')"
                type="number"
                prefix="R$"
                clearable
              />
            </v-col>
            <v-col cols="12">
              <v-select
                v-model="form.service_provider_id"
                :label="t('maintenance.fields.serviceProvider')"
                :items="providerItems"
                clearable
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.notes"
                :label="t('maintenance.fields.notes')"
                rows="2"
                auto-grow
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.next_service_date"
                :label="t('maintenance.fields.nextServiceDate')"
                type="date"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.next_service_km"
                :label="t('maintenance.fields.nextServiceKm')"
                type="number"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.reminder_lead_days"
                :label="t('maintenance.fields.reminderLeadDays')"
                type="number"
                :rules="[required]"
              />
            </v-col>
          </v-row>
          <v-alert v-if="errorMsg" type="error" variant="tonal" class="mt-2">
            {{ errorMsg }}
          </v-alert>
        </v-form>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" @click="model = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" :loading="saving" @click="submit">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMaintenanceStore } from '@/stores/maintenance.store'
import { useProvidersStore } from '@/stores/providers.store'
import { useSettingsStore } from '@/stores/settings.store'
import { CATEGORY_ICONS, ALL_CATEGORIES } from '@/utils/maintenanceCategories'
import type { MaintenanceRecord, MaintenanceRecordInsert, MaintenanceCategory } from '@/types'

const props = defineProps<{
  vehicleId: string
  record: MaintenanceRecord | null
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const model = defineModel<boolean>()

const { t } = useI18n()
const maintenanceStore = useMaintenanceStore()
const providersStore = useProvidersStore()
const settingsStore = useSettingsStore()

const formRef = ref()
const saving = ref(false)
const errorMsg = ref('')

const defaultForm = (): MaintenanceRecordInsert => ({
  vehicle_id: props.vehicleId,
  category: 'general_repair',
  record_date: new Date().toISOString().slice(0, 10),
  odometer_km: null,
  total_cost: 0,
  labor_cost: null,
  parts_cost: null,
  service_provider_id: null,
  notes: null,
  next_service_date: null,
  next_service_km: null,
  reminder_lead_days: settingsStore.settings?.default_reminder_lead_days ?? 14,
})

const form = ref<MaintenanceRecordInsert>(defaultForm())

watch(model, (open) => {
  if (open) {
    errorMsg.value = ''
    if (props.record) {
      form.value = {
        vehicle_id: props.record.vehicle_id,
        category: props.record.category,
        record_date: props.record.record_date,
        odometer_km: props.record.odometer_km,
        total_cost: props.record.total_cost,
        labor_cost: props.record.labor_cost,
        parts_cost: props.record.parts_cost,
        service_provider_id: props.record.service_provider_id,
        notes: props.record.notes,
        next_service_date: props.record.next_service_date,
        next_service_km: props.record.next_service_km,
        reminder_lead_days: props.record.reminder_lead_days,
      }
    } else {
      form.value = defaultForm()
    }
    if (providersStore.providers.length === 0) providersStore.fetchAll()
  }
})

const categoryItems = computed(() =>
  ALL_CATEGORIES.map((c) => ({ title: t(`maintenance.categories.${c}`), value: c })),
)

const providerItems = computed(() =>
  providersStore.providers.map((p) => ({ title: p.name, value: p.id })),
)

const required = (v: unknown) => (v !== null && v !== undefined && v !== '') || t('common.required')
const nonNegative = (v: number) => v >= 0 || t('common.nonNegative')

async function submit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (props.record) {
      await maintenanceStore.update(props.record.id, form.value)
    } else {
      await maintenanceStore.create(form.value)
    }
    model.value = false
    emit('saved')
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    saving.value = false
  }
}
</script>
