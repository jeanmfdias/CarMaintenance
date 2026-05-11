import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ServiceUnavailable from '@/components/common/ServiceUnavailable.vue'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/api', () => ({
  api: {
    auth: {
      sendMagicLink: vi.fn(),
      verify: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
    },
    health: vi.fn().mockResolvedValue(true),
  },
  getToken: vi.fn().mockReturnValue(null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  onUnauthorized: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 0
    code = ''
  },
}))

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('ServiceUnavailable', () => {
  it('renders without errors', () => {
    const wrapper = mount(ServiceUnavailable, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows the retry button', () => {
    const wrapper = mount(ServiceUnavailable, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('Try again')
  })

  it('calls retryConnection when retry button is clicked', async () => {
    const pinia = createPinia()
    const wrapper = mount(ServiceUnavailable, {
      global: { plugins: [pinia] },
    })
    // Use the same pinia instance as the mounted component
    const store = useAuthStore(pinia)
    const spy = vi.spyOn(store, 'retryConnection').mockResolvedValue(undefined)
    await wrapper.find('button').trigger('click')
    expect(spy).toHaveBeenCalled()
  })
})
