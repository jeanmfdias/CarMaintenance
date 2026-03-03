import { createI18n } from 'vue-i18n'
import en from '@/locales/en'
import ptBR from '@/locales/pt-BR'

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, 'pt-BR': ptBR },
})
