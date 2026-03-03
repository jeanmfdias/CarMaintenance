<template>
  <v-container class="fill-height" style="max-width: 440px">
    <v-row align="center" justify="center" class="fill-height">
      <v-col cols="12">
        <v-card class="pa-6">
          <div class="text-center mb-6">
            <v-icon size="56" color="primary">mdi-car-wrench</v-icon>
            <h1 class="text-h5 mt-3">{{ t('auth.title') }}</h1>
            <p class="text-body-2 text-medium-emphasis mt-1">{{ t('auth.subtitle') }}</p>
          </div>

          <template v-if="!linkSent">
            <v-text-field
              v-model="email"
              :label="t('auth.emailLabel')"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              :error-messages="errorMsg"
              autocomplete="email"
              @keyup.enter="submit"
            />
            <v-btn
              block
              color="primary"
              size="large"
              :loading="loading"
              :disabled="!email"
              class="mt-2"
              @click="submit"
            >
              {{ t('auth.sendLink') }}
            </v-btn>
          </template>

          <template v-else>
            <div class="text-center">
              <v-icon size="64" color="success">mdi-email-check-outline</v-icon>
              <p class="text-body-1 font-weight-medium mt-4">{{ t('auth.linkSent') }}</p>
              <p class="text-body-2 text-medium-emphasis mt-2">
                {{ t('auth.linkSentDesc', { email }) }}
              </p>
              <v-btn variant="text" class="mt-4" @click="linkSent = false">
                {{ t('auth.emailLabel') }}
              </v-btn>
            </div>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'

const { t } = useI18n()
const authStore = useAuthStore()

const email = ref('')
const loading = ref(false)
const linkSent = ref(false)
const errorMsg = ref('')

async function submit() {
  if (!email.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    await authStore.sendMagicLink(email.value)
    linkSent.value = true
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : t('common.error')
  } finally {
    loading.value = false
  }
}
</script>
