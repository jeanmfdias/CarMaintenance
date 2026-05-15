import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore, setUnauthenticatedRedirect } from '@/stores/auth.store'

function detectBasePath(): string {
  const re = /^https?:\/\/[^/]+(\/.*?\/)assets\//
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]'))
  for (const s of scripts) {
    const match = re.exec(s.src)
    if (match?.[1]) return match[1]
  }
  return '/'
}

const router = createRouter({
  history: createWebHistory(detectBasePath()),
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

// When the API client signals a 401, the auth store wipes local state and
// then calls this callback so the router can move the user back to /login.
// Only redirect when the current route required auth — otherwise we stay put
// (e.g. on the login page itself, an expired-token verify attempt).
setUnauthenticatedRedirect(() => {
  if (router.currentRoute.value.meta.requiresAuth) {
    router.replace({ name: 'login' }).catch(() => {
      // Ignore navigation errors (e.g., redundant navigation).
    })
  }
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
