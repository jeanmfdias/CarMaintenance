<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <h1 class="text-h5">{{ t('providers.title') }}</h1>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('providers.addProvider') }}
      </v-btn>
    </div>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <EmptyState
      v-if="!store.loading && store.providers.length === 0"
      :message="t('providers.noProviders')"
      icon="mdi-store-off-outline"
    >
      <v-btn color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
        {{ t('providers.addProvider') }}
      </v-btn>
    </EmptyState>

    <v-list v-else lines="two">
      <v-list-item
        v-for="provider in store.providers"
        :key="provider.id"
        :title="provider.name"
        :subtitle="[provider.phone, provider.address].filter(Boolean).join(' · ')"
        prepend-icon="mdi-store-outline"
      >
        <template #append>
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn icon variant="text" size="small" v-bind="menuProps">
                <v-icon>mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list density="compact">
              <v-list-item
                prepend-icon="mdi-pencil-outline"
                :title="t('common.edit')"
                @click="openEdit(provider)"
              />
              <v-list-item
                prepend-icon="mdi-delete-outline"
                :title="t('common.delete')"
                base-color="error"
                @click="openDelete(provider)"
              />
            </v-list>
          </v-menu>
        </template>
      </v-list-item>
    </v-list>

    <ProviderFormDialog
      v-model="formDialog"
      :record="editRecord"
      @saved="formDialog = false"
    />

    <ConfirmDialog
      v-model="deleteDialog"
      :message="t('providers.deleteConfirm')"
      :confirm-label="t('common.delete')"
      destructive
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProvidersStore } from '@/stores/providers.store'
import ProviderFormDialog from '@/components/providers/ProviderFormDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import type { ServiceProvider } from '@/types'

const { t } = useI18n()
const store = useProvidersStore()

const formDialog = ref(false)
const deleteDialog = ref(false)
const editRecord = ref<ServiceProvider | null>(null)
const deleteTarget = ref<ServiceProvider | null>(null)

onMounted(() => store.fetchAll())

function openCreate() {
  editRecord.value = null
  formDialog.value = true
}

function openEdit(provider: ServiceProvider) {
  editRecord.value = provider
  formDialog.value = true
}

function openDelete(provider: ServiceProvider) {
  deleteTarget.value = provider
  deleteDialog.value = true
}

async function confirmDelete() {
  if (deleteTarget.value) {
    await store.remove(deleteTarget.value.id)
    deleteTarget.value = null
  }
}
</script>
