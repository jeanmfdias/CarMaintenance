<template>
  <v-app-bar color="primary" elevation="2">
    <v-app-bar-nav-icon @click="drawer = !drawer" />
    <v-app-bar-title>{{ t('app.name') }}</v-app-bar-title>
    <template #append>
      <v-btn icon variant="text" @click="handleSignOut">
        <v-icon>mdi-logout</v-icon>
        <v-tooltip activator="parent">{{ t('nav.signOut') }}</v-tooltip>
      </v-btn>
    </template>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" temporary>
    <v-list nav>
      <v-list-item
        prepend-icon="mdi-car-multiple"
        :title="t('nav.vehicles')"
        :to="{ name: 'vehicle-list' }"
        rounded="lg"
      />
    </v-list>
    <template #append>
      <v-list nav>
        <v-list-item
          prepend-icon="mdi-logout"
          :title="t('nav.signOut')"
          rounded="lg"
          @click="handleSignOut"
        />
      </v-list>
    </template>
  </v-navigation-drawer>

  <v-main>
    <v-container fluid class="pa-4">
      <router-view />
    </v-container>
  </v-main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const drawer = ref(false)

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>
