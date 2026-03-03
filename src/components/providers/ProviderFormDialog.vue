<template>
  <v-dialog v-model="model" max-width="520" scrollable>
    <v-card>
      <v-card-title>
        {{ record ? t('providers.editProvider') : t('providers.addProvider') }}
      </v-card-title>
      <v-card-text>
        <v-form ref="formRef" @submit.prevent="submit">
          <v-text-field
            v-model="form.name"
            :label="t('providers.fields.name')"
            :rules="[required]"
            class="mb-2"
          />
          <v-text-field
            v-model="form.phone"
            :label="t('providers.fields.phone')"
            clearable
            class="mb-2"
          />
          <v-text-field
            v-model="form.email"
            :label="t('providers.fields.email')"
            type="email"
            clearable
            class="mb-2"
          />
          <v-text-field
            v-model="form.address"
            :label="t('providers.fields.address')"
            clearable
            class="mb-2"
          />
          <v-text-field
            v-model="form.website"
            :label="t('providers.fields.website')"
            clearable
            class="mb-2"
          />
          <v-textarea
            v-model="form.notes"
            :label="t('providers.fields.notes')"
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
import { useProvidersStore } from '@/stores/providers.store'
import type { ServiceProvider, ServiceProviderInsert } from '@/types'

const props = defineProps<{ record: ServiceProvider | null }>()
const emit = defineEmits<{ (e: 'saved'): void }>()
const model = defineModel<boolean>()

const { t } = useI18n()
const providersStore = useProvidersStore()

const formRef = ref()
const saving = ref(false)
const errorMsg = ref('')

const defaultForm = (): ServiceProviderInsert => ({
  name: '',
  address: null,
  phone: null,
  email: null,
  website: null,
  notes: null,
})

const form = ref<ServiceProviderInsert>(defaultForm())

watch(model, (open) => {
  if (open) {
    errorMsg.value = ''
    form.value = props.record
      ? { name: props.record.name, address: props.record.address, phone: props.record.phone, email: props.record.email, website: props.record.website, notes: props.record.notes }
      : defaultForm()
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
      await providersStore.update(props.record.id, form.value)
    } else {
      await providersStore.create(form.value)
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
