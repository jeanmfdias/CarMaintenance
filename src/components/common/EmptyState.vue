<template>
  <div class="text-center py-12">
    <v-icon :icon="icon" size="64" color="medium-emphasis" />
    <p class="text-body-1 text-medium-emphasis mt-4">{{ message }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string
  icon?: string
}>()
</script>
