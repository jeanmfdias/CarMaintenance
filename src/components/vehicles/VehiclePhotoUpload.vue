<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="d-none"
      :aria-label="t('vehicles.photoUpload.uploadPrompt')"
      @change="handleFileChange"
    />
    <v-card
      class="d-flex align-center justify-center"
      height="160"
      variant="outlined"
      style="cursor: pointer; border-style: dashed"
      @click="fileInput?.click()"
    >
      <v-img v-if="previewUrl" :src="previewUrl" cover height="160" :alt="t('vehicles.fields.photo')" />
      <div v-else class="text-center pa-4">
        <v-icon size="48" color="medium-emphasis">mdi-camera-plus-outline</v-icon>
        <p class="text-caption text-medium-emphasis mt-1">{{ t('vehicles.photoUpload.uploadPrompt') }}</p>
        <p class="text-caption text-medium-emphasis">{{ t('vehicles.photoUpload.hint') }}</p>
      </div>
    </v-card>
    <p v-if="error" class="text-caption text-error mt-1">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits<{ (e: 'change', file: File): void }>()

const fileInput = ref<HTMLInputElement>()
const previewUrl = ref<string>()
// True when previewUrl points at a blob URL we created (and therefore must
// revoke). False when set via `setPreview` from a parent (the caller owns it).
const ownsPreview = ref(false)
const error = ref('')
const MAX_SIZE = 5 * 1024 * 1024

function revokeOwned() {
  if (ownsPreview.value && previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
}

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > MAX_SIZE) {
    error.value = t('vehicles.photoUpload.tooLarge')
    return
  }
  error.value = ''
  revokeOwned()
  previewUrl.value = URL.createObjectURL(file)
  ownsPreview.value = true
  emit('change', file)
}

function setPreview(url: string) {
  // Parent owns this URL (e.g. obtained via useObjectUrl) — don't revoke it.
  revokeOwned()
  previewUrl.value = url
  ownsPreview.value = false
}

onBeforeUnmount(revokeOwned)

defineExpose({ setPreview })
</script>
