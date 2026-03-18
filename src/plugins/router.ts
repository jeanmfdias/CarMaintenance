import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/pages/auth/AuthCallbackPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/vehicles' },
        {
          path: 'vehicles',
          name: 'vehicle-list',
          component: () => import('@/pages/vehicles/VehicleListPage.vue'),
        },
        {
          path: 'vehicles/new',
          name: 'vehicle-new',
          component: () => import('@/pages/vehicles/VehicleFormPage.vue'),
        },
        {
          path: 'vehicles/:id',
          name: 'vehicle-detail',
          component: () => import('@/pages/vehicles/VehicleDetailPage.vue'),
        },
        {
          path: 'vehicles/:id/edit',
          name: 'vehicle-edit',
          component: () => import('@/pages/vehicles/VehicleFormPage.vue'),
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/DashboardPage.vue'),
        },
        {
          path: 'providers',
          name: 'provider-list',
          component: () => import('@/pages/providers/ProvidersPage.vue'),
        },
        {
          path: 'import',
          name: 'import-legacy',
          component: () => import('@/pages/import/ImportPage.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/settings/SettingsPage.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (auth.loading) {
    await new Promise<void>((resolve) => {
      const stop = watch(
        () => auth.loading,
        (val) => {
          if (!val) {
            stop()
            resolve()
          }
        },
      )
    })
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (!to.meta.requiresAuth && auth.isAuthenticated && to.name !== 'auth-callback') {
    return { name: 'vehicle-list' }
  }
})

export default router
