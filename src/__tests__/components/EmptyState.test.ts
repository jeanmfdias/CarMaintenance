import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '@/components/common/EmptyState.vue'

describe('EmptyState', () => {
  it('renders the message prop', () => {
    const wrapper = mount(EmptyState, {
      props: { message: 'Nothing here yet.' },
    })
    expect(wrapper.text()).toContain('Nothing here yet.')
  })

  it('renders with an icon prop', () => {
    const wrapper = mount(EmptyState, {
      props: { message: 'Empty', icon: 'mdi-car' },
    })
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders slot content', () => {
    const wrapper = mount(EmptyState, {
      props: { message: 'Empty' },
      slots: { default: '<button>Add item</button>' },
    })
    expect(wrapper.text()).toContain('Add item')
  })
})
