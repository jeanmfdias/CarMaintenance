<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" size="64" />
        <p class="mt-4 text-body-1">Signing you in...</p>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

watch(
  () => auth.loading,
  (loading) => {
    if (!loading) {
      router.replace(auth.isAuthenticated ? '/vehicles' : '/login')
    }
  },
  { immediate: true },
)
</script>
