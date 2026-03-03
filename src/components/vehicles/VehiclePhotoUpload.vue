<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="d-none"
      @change="handleFileChange"
    />
    <v-card
      class="d-flex align-center justify-center"
      height="160"
      variant="outlined"
      style="cursor: pointer; border-style: dashed"
      @click="fileInput?.click()"
    >
      <v-img v-if="previewUrl" :src="previewUrl" cover height="160" />
      <div v-else class="text-center pa-4">
        <v-icon size="48" color="medium-emphasis">mdi-camera-plus-outline</v-icon>
        <p class="text-caption text-medium-emphasis mt-1">Click to upload photo</p>
        <p class="text-caption text-medium-emphasis">JPEG, PNG, WebP · max 5 MB</p>
      </div>
    </v-card>
    <p v-if="error" class="text-caption text-error mt-1">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ (e: 'change', file: File): void }>()

const fileInput = ref<HTMLInputElement>()
const previewUrl = ref<string>()
const error = ref('')
const MAX_SIZE = 5 * 1024 * 1024

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > MAX_SIZE) {
    error.value = 'File must be under 5 MB.'
    return
  }
  error.value = ''
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  emit('change', file)
}

function setPreview(url: string) {
  previewUrl.value = url
}

defineExpose({ setPreview })
</script>
