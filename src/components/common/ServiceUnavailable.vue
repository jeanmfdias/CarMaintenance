<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-col cols="12" sm="8" md="5" class="text-center">
      <v-icon icon="mdi-cloud-off-outline" size="80" color="medium-emphasis" class="mb-6" />

      <h1 class="text-h5 font-weight-bold mb-3">{{ $t('serviceUnavailable.title') }}</h1>

      <p class="text-body-1 text-medium-emphasis mb-8">
        {{ $t('serviceUnavailable.message') }}
      </p>

      <v-btn
        color="primary"
        variant="flat"
        size="large"
        :loading="retrying"
        prepend-icon="mdi-refresh"
        @click="retry"
      >
        {{ $t('serviceUnavailable.retry') }}
      </v-btn>
    </v-col>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()
const retrying = ref(false)

async function retry() {
  retrying.value = true
  await authStore.retryConnection()
  retrying.value = false
}
</script>
