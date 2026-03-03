<template>
  <div style="max-width: 640px">
    <div class="d-flex align-center mb-6">
      <v-btn icon variant="text" :to="{ name: 'vehicle-list' }">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h5 ml-2">
        {{ isEdit ? t('vehicles.editTitle') : t('vehicles.newTitle') }}
      </h1>
    </div>

    <v-form ref="formRef" @submit.prevent="submit">
      <v-row>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.make"
            :label="t('vehicles.fields.make')"
            :rules="[required]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.model"
            :label="t('vehicles.fields.model')"
            :rules="[required]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="form.manufacture_year"
            :label="t('vehicles.fields.manufactureYear')"
            type="number"
            :rules="[required, yearRule]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="form.model_year"
            :label="t('vehicles.fields.modelYear')"
            type="number"
            :rules="[required, yearRule]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-select
            v-model="form.fuel_type"
            :label="t('vehicles.fields.fuelType')"
            :items="fuelTypeItems"
            :rules="[required]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="form.current_odometer"
            :label="t('vehicles.fields.currentOdometer')"
            type="number"
            :rules="[required, nonNegative]"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="form.purchase_date"
            :label="t('vehicles.fields.purchaseDate')"
            type="date"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="form.notes"
            :label="t('vehicles.fields.notes')"
            rows="3"
            auto-grow
          />
        </v-col>
        <v-col cols="12">
          <p class="text-body-2 mb-2">{{ t('vehicles.fields.photo') }}</p>
          <VehiclePhotoUpload ref="photoUploadRef" @change="pendingPhoto = $event" />
        </v-col>
      </v-row>

      <v-alert v-if="errorMsg" type="error" variant="tonal" class="mt-4">
        {{ errorMsg }}
      </v-alert>

      <div class="d-flex gap-3 mt-6">
        <v-btn variant="text" :to="{ name: 'vehicle-list' }">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" type="submit" :loading="saving">{{ t('common.save') }}</v-btn>
      </div>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useVehiclesStore } from '@/stores/vehicles.store'
import VehiclePhotoUpload from '@/components/vehicles/VehiclePhotoUpload.vue'
import type { FuelType } from '@/types'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const store = useVehiclesStore()

const formRef = ref()
const photoUploadRef = ref<InstanceType<typeof VehiclePhotoUpload>>()
const saving = ref(false)
const errorMsg = ref('')
const pendingPhoto = ref<File | null>(null)

const isEdit = computed(() => !!route.params.id)

const form = ref({
  make: '',
  model: '',
  manufacture_year: new Date().getFullYear(),
  model_year: new Date().getFullYear(),
  fuel_type: 'flex' as FuelType,
  current_odometer: 0,
  purchase_date: null as string | null,
  sell_date: null as string | null,
  notes: null as string | null,
  photo_url: null as string | null,
})

const fuelTypeItems = (['gasoline', 'diesel', 'ethanol', 'flex', 'electric', 'hybrid'] as FuelType[]).map(
  (v) => ({ title: t(`vehicles.fuelTypes.${v}`), value: v }),
)

const required = (v: unknown) => !!v || 'Required'
const yearRule = (v: number) => (v >= 1900 && v <= 2100) || 'Invalid year'
const nonNegative = (v: number) => v >= 0 || 'Must be 0 or greater'

onMounted(async () => {
  if (isEdit.value) {
    const vehicle = store.vehicles.find((v) => v.id === route.params.id)
    if (vehicle) {
      form.value = {
        make: vehicle.make,
        model: vehicle.model,
        manufacture_year: vehicle.manufacture_year,
        model_year: vehicle.model_year,
        fuel_type: vehicle.fuel_type,
        current_odometer: vehicle.current_odometer,
        purchase_date: vehicle.purchase_date,
        sell_date: vehicle.sell_date,
        notes: vehicle.notes,
        photo_url: vehicle.photo_url,
      }
      if (vehicle.photo_url) {
        try {
          const url = await store.getPhotoUrl(vehicle.photo_url)
          photoUploadRef.value?.setPreview(url)
        } catch {
          // ignore
        }
      }
    }
  }
})

async function submit() {
  const { valid } = await formRef.value.validate()
  if (!valid) return

  saving.value = true
  errorMsg.value = ''
  try {
    if (isEdit.value) {
      const vehicleId = route.params.id as string
      await store.update(vehicleId, form.value)
      if (pendingPhoto.value) {
        const path = await store.uploadPhoto(vehicleId, pendingPhoto.value)
        await store.update(vehicleId, { photo_url: path })
      }
    } else {
      const vehicle = await store.create(form.value)
      if (pendingPhoto.value) {
        const path = await store.uploadPhoto(vehicle.id, pendingPhoto.value)
        await store.update(vehicle.id, { photo_url: path })
      }
    }
    router.push({ name: 'vehicle-list' })
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    saving.value = false
  }
}
</script>
