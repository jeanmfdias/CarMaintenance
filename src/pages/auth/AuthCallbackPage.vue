<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" md="6" lg="4" class="text-center">
        <template v-if="errorMessage">
          <v-icon color="warning" size="64" class="mb-4">mdi-alert-circle-outline</v-icon>
          <h2 class="text-h5 mb-2">{{ t('auth.callbackError.title') }}</h2>
          <p class="text-body-1 mb-6">{{ errorMessage }}</p>
          <v-btn color="primary" :to="{ name: 'login' }">
            {{ t('auth.callbackError.backToLogin') }}
          </v-btn>
        </template>
        <template v-else>
          <v-progress-circular indeterminate color="primary" size="64" />
          <p class="mt-4 text-body-1">{{ t('auth.signingIn') }}</p>
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
  }
  return params
}

const hashParams = parseHashParams(window.location.hash)
const queryParams = new URLSearchParams(window.location.search)
const errorCode = hashParams['error_code'] ?? queryParams.get('error_code') ?? ''
const errorParam = hashParams['error'] ?? queryParams.get('error') ?? ''
const errorDescription = hashParams['error_description'] ?? queryParams.get('error_description') ?? ''

const errorMessage = ref<string>('')
if (errorCode || errorParam) {
  errorMessage.value =
    errorCode === 'otp_expired' || /expired/i.test(errorDescription)
      ? t('auth.callbackError.expired')
      : t('auth.callbackError.generic')
}

if (!errorMessage.value) {
  watch(
    () => auth.loading,
    (loading) => {
      if (!loading) {
        router.replace(auth.isAuthenticated ? '/vehicles' : '/login')
      }
    },
    { immediate: true },
  )
}
</script>
