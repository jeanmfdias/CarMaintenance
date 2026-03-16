import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ServiceUnavailable from '@/components/common/ServiceUnavailable.vue'
import { useAuthStore } from '@/stores/auth.store'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
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
