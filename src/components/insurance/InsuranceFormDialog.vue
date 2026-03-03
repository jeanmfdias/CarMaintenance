<template>
  <v-dialog v-model="model" max-width="560" scrollable>
    <v-card>
      <v-card-title>
        {{ record ? t('insurance.editPolicy') : t('insurance.addPolicy') }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.insurer"
                :label="t('insurance.fields.insurer')"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.policy_number"
                :label="t('insurance.fields.policyNumber')"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.start_date"
                :label="t('insurance.fields.startDate')"
                type="date"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.expiry_date"
                :label="t('insurance.fields.expiryDate')"
                type="date"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.annual_cost"
                :label="t('insurance.fields.annualCost')"
                type="number"
                prefix="R$"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.reminder_lead_days"
                :label="t('insurance.fields.reminderLeadDays')"
                type="number"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.notes"
                :label="t('insurance.fields.notes')"
                rows="2"
                auto-grow
                clearable
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
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInsuranceStore } from '@/stores/insurance.store'
import { useSettingsStore } from '@/stores/settings.store'
import type { InsurancePolicy, InsurancePolicyInsert } from '@/types'

const props = defineProps<{
  vehicleId: string
  record: InsurancePolicy | null
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const model = defineModel<boolean>()

const { t } = useI18n()
const insuranceStore = useInsuranceStore()
const settingsStore = useSettingsStore()

const formRef = ref()
const saving = ref(false)
const errorMsg = ref('')

const defaultForm = (): InsurancePolicyInsert => ({
  vehicle_id: props.vehicleId,
  insurer: '',
  policy_number: null,
  start_date: new Date().toISOString().slice(0, 10),
  expiry_date: '',
  annual_cost: null,
  notes: null,
  reminder_lead_days: settingsStore.settings?.default_reminder_lead_days ?? 30,
})

const form = ref<InsurancePolicyInsert>(defaultForm())

watch(model, (open) => {
  if (open) {
    errorMsg.value = ''
    if (props.record) {
      form.value = {
        vehicle_id: props.record.vehicle_id,
        insurer: props.record.insurer,
        policy_number: props.record.policy_number,
        start_date: props.record.start_date,
        expiry_date: props.record.expiry_date,
        annual_cost: props.record.annual_cost,
        notes: props.record.notes,
        reminder_lead_days: props.record.reminder_lead_days,
      }
    } else {
      form.value = defaultForm()
    }
  }
})

const required = (v: unknown) => (v !== null && v !== undefined && v !== '') || t('common.required')

async function submit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (props.record) {
      await insuranceStore.update(props.record.id, form.value)
    } else {
      await insuranceStore.create(form.value)
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
