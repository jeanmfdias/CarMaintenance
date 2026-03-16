<template>
  <v-app>
    <ServiceUnavailable v-if="authStore.serviceUnavailable" />
    <router-view v-else />
  </v-app>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store'
import ServiceUnavailable from '@/components/common/ServiceUnavailable.vue'

const authStore = useAuthStore()
</script>
