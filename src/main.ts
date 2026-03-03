import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './plugins/router'
import { vuetify } from './plugins/vuetify'
import { i18n } from './plugins/i18n'
import { useAuthStore } from './stores/auth.store'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(vuetify)
app.use(i18n)

const authStore = useAuthStore()
authStore.init().then(() => {
  app.mount('#app')
})
