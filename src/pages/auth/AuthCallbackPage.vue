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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { ApiError } from '@/lib/api'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const errorMessage = ref<string>('')

function classifyError(message: string): string {
  if (/expire/i.test(message) || /already been used/i.test(message)) {
    return t('auth.callbackError.expired')
  }
  return t('auth.callbackError.generic')
}

onMounted(async () => {
  const queryParams = new URLSearchParams(window.location.search)
  const token = queryParams.get('token')

  if (!token) {
    errorMessage.value = t('auth.callbackError.missingToken')
    return
  }

  try {
    await auth.verifyMagicLink(token)
    router.replace({ name: 'vehicle-list' })
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      errorMessage.value = classifyError(e.message)
    } else {
      errorMessage.value = t('auth.callbackError.generic')
    }
  }
})
</script>
