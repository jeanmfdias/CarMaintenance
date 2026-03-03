<template>
  <v-dialog v-model="model" max-width="560" scrollable>
    <v-card>
      <v-card-title>
        {{ record ? t('fuel.editFillup') : t('fuel.addFillup') }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="form.fillup_date"
                :label="t('fuel.fields.date')"
                type="date"
                :rules="[required]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.odometer_km"
                :label="t('fuel.fields.odometer')"
                type="number"
                :rules="[required, nonNegative]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.liters"
                :label="t('fuel.fields.liters')"
                type="number"
                suffix="L"
                :rules="[required, positive]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="form.total_cost"
                :label="t('fuel.fields.totalCost')"
                type="number"
                prefix="R$"
                :rules="[required, nonNegative]"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-select
                v-model="form.fuel_type"
                :label="t('fuel.fields.fuelType')"
                :items="fuelTypeItems"
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6" class="d-flex align-center">
              <v-checkbox
                v-model="form.full_tank"
                :label="t('fuel.fields.fullTank')"
                hide-details
              />
            </v-col>
            <v-col v-if="pricePreview" cols="12">
              <v-chip color="primary" variant="tonal" prepend-icon="mdi-tag-outline">
                {{ t('fuel.fields.pricePerLiter') }}: R$ {{ pricePreview }}
              </v-chip>
            </v-col>
            <v-col cols="12">
              <v-textarea
                v-model="form.notes"
                :label="t('fuel.fields.notes')"
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
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFuelStore } from '@/stores/fuel.store'
import type { FuelFillup, FuelFillupInsert, FuelType } from '@/types'

const props = defineProps<{
  vehicleId: string
  record: FuelFillup | null
}>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const model = defineModel<boolean>()

const { t } = useI18n()
const fuelStore = useFuelStore()

const formRef = ref()
const saving = ref(false)
const errorMsg = ref('')

const defaultForm = (): FuelFillupInsert => ({
  vehicle_id: props.vehicleId,
  fillup_date: new Date().toISOString().slice(0, 10),
  odometer_km: 0,
  liters: 0,
  total_cost: 0,
  fuel_type: null,
  full_tank: true,
  notes: null,
})

const form = ref<FuelFillupInsert>(defaultForm())

watch(model, (open) => {
  if (open) {
    errorMsg.value = ''
    if (props.record) {
      form.value = {
        vehicle_id: props.record.vehicle_id,
        fillup_date: props.record.fillup_date,
        odometer_km: props.record.odometer_km,
        liters: props.record.liters,
        total_cost: props.record.total_cost,
        fuel_type: props.record.fuel_type,
        full_tank: props.record.full_tank,
        notes: props.record.notes,
      }
    } else {
      form.value = defaultForm()
    }
  }
})

const pricePreview = computed(() => {
  if (form.value.liters > 0 && form.value.total_cost > 0) {
    return (form.value.total_cost / form.value.liters).toFixed(4)
  }
  return null
})

const fuelTypeItems = (['gasoline', 'diesel', 'ethanol', 'flex', 'electric', 'hybrid'] as FuelType[]).map(
  (v) => ({ title: t(`vehicles.fuelTypes.${v}`), value: v }),
)

const required = (v: unknown) => (v !== null && v !== undefined && v !== '') || t('common.required')
const nonNegative = (v: number) => v >= 0 || t('common.nonNegative')
const positive = (v: number) => v > 0 || t('common.positive')

async function submit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  errorMsg.value = ''
  try {
    if (props.record) {
      await fuelStore.update(props.record.id, form.value)
    } else {
      await fuelStore.create(form.value)
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
