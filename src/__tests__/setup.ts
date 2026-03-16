import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import { vi } from 'vitest'
import en from '@/locales/en'
import ptBR from '@/locales/pt-BR'

const vuetify = createVuetify({ components, directives })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en, 'pt-BR': ptBR },
})

config.global.plugins = [vuetify, i18n]

// AbortSignal.timeout is not available in happy-dom
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn().mockReturnValue(new AbortController().signal)
}

// ResizeObserver must be a class (not an arrow function) so `new ResizeObserver()` works
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// VOverlay (used by v-dialog) reads window.visualViewport for positioning
if (!globalThis.visualViewport) {
  Object.defineProperty(globalThis, 'visualViewport', {
    value: {
      width: 1024,
      height: 768,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
  })
}
