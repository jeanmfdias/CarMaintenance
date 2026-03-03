<template>
  <v-dialog v-model="model" max-width="360">
    <v-card>
      <v-card-title>
        {{ record ? t('odometer.editEntry') : t('odometer.addEntry') }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.reading_date"
            :label="t('odometer.fields.date')"
            type="date"
            :rules="[required]"
            class="mb-2"
          />
          <v-text-field
            v-model.number="form.reading_km"
            :label="t('odometer.fields.reading')"
            type="number"
            suffix="km"
            :rules="[required, positive]"
            class="mb-2"
          />
          <v-textarea
            v-model="form.notes"
            :label="t('odometer.fields.notes')"
            rows="2"
            auto-grow
            clearable
          />
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
import { useOdometerStore } from '@/stores/odometer.store'
import type { OdometerEntry, OdometerEntryInsert } from '@/types'

const props = defineProps<{
  vehicleId: string
  record: OdometerEntry | null
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const model = defineModel<boolean>()

const { t } = useI18n()
const odometerStore = useOdometerStore()

const formRef = ref()
const saving = ref(false)
const errorMsg = ref('')

const defaultForm = (): OdometerEntryInsert => ({
  vehicle_id: props.vehicleId,
  reading_date: new Date().toISOString().slice(0, 10),
  reading_km: 0,
  notes: null,
})

const form = ref<OdometerEntryInsert>(defaultForm())

watch(model, (open) => {
  if (open) {
    errorMsg.value = ''
    form.value = props.record
      ? { vehicle_id: props.record.vehicle_id, reading_date: props.record.reading_date, reading_km: props.record.reading_km, notes: props.record.notes }
      : defaultForm()
  }
})

const required = (v: unknown) => (v !== null && v !== undefined && v !== '') || t('common.required')
const positive = (v: number) => v > 0 || t('common.positive')

async function submit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (props.record) {
      await odometerStore.update(props.record.id, form.value)
    } else {
      await odometerStore.create(form.value)
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
