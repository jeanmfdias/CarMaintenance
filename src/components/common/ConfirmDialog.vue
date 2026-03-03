<template>
  <v-dialog v-model="model" max-width="400">
    <v-card>
      <v-card-title>{{ title || t('common.confirm') }}</v-card-title>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" @click="model = false">{{ t('common.cancel') }}</v-btn>
        <v-btn :color="destructive ? 'error' : 'primary'" @click="confirm">
          {{ confirmLabel || t('common.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const model = defineModel<boolean>()

defineProps<{
  message: string
  title?: string
  confirmLabel?: string
  destructive?: boolean
}>()

const emit = defineEmits<{ (e: 'confirm'): void }>()

function confirm() {
  emit('confirm')
  model.value = false
}
</script>
