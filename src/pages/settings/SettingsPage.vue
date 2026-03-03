<template>
  <div style="max-width: 480px">
    <h1 class="text-h5 mb-6">{{ t('settings.title') }}</h1>

    <v-progress-linear v-if="settingsStore.loading" indeterminate color="primary" class="mb-4" />

    <v-card>
      <v-card-text>
        <v-select
          v-model="form.locale"
          :label="t('settings.fields.language')"
          :items="localeItems"
          class="mb-4"
        />
        <v-text-field
          v-model.number="form.default_reminder_lead_days"
          :label="t('settings.fields.defaultReminderLeadDays')"
          type="number"
          :rules="[nonNegative]"
          suffix="days"
        />
      </v-card-text>
      <v-card-actions class="px-4 pb-4">
        <v-btn color="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings.store'
import { showSnackbar } from '@/composables/useSnackbar'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const saving = ref(false)

const form = ref<{ locale: 'en' | 'pt-BR'; default_reminder_lead_days: number }>({
  locale: 'en',
  default_reminder_lead_days: 30,
})

const localeItems = [
  { title: 'English', value: 'en' },
  { title: 'Português (BR)', value: 'pt-BR' },
]

const nonNegative = (v: number) => v >= 0 || t('common.nonNegative')

onMounted(async () => {
  await settingsStore.fetch()
  if (settingsStore.settings) {
    form.value.locale = settingsStore.settings.locale ?? 'en'
    form.value.default_reminder_lead_days = settingsStore.settings.default_reminder_lead_days ?? 30
  }
})

async function save() {
  saving.value = true
  try {
    await settingsStore.save(form.value)
    showSnackbar(t('settings.saved'))
  } catch {
    showSnackbar(t('common.error'), 'error')
  } finally {
    saving.value = false
  }
}
</script>
