import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

// Stub Vuetify components with minimal HTML so we can test ConfirmDialog's own logic
const vuetifyStubs = {
  VDialog: { template: '<div><slot /></div>' },
  VCard: { template: '<div><slot /></div>' },
  VCardTitle: { template: '<div><slot /></div>' },
  VCardText: { template: '<div><slot /></div>' },
  VCardActions: { template: '<div><slot /></div>' },
  VBtn: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
}

const mountDialog = (props: InstanceType<typeof ConfirmDialog>['$props']) =>
  mount(ConfirmDialog, {
    props,
    global: { stubs: vuetifyStubs },
  })

describe('ConfirmDialog', () => {
  it('renders the message', () => {
    const wrapper = mountDialog({ modelValue: true, message: 'Are you sure?' })
    expect(wrapper.text()).toContain('Are you sure?')
  })

  it('renders a custom title when provided', () => {
    const wrapper = mountDialog({ modelValue: true, message: 'Delete it?', title: 'Delete vehicle' })
    expect(wrapper.text()).toContain('Delete vehicle')
  })

  it('emits confirm when the confirm button is clicked', async () => {
    const wrapper = mountDialog({ modelValue: true, message: 'Proceed?' })
    const buttons = wrapper.findAll('button')
    await buttons.at(-1)!.trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('closes the dialog after confirm', async () => {
    const wrapper = mountDialog({ modelValue: true, message: 'Proceed?' })
    const buttons = wrapper.findAll('button')
    await buttons.at(-1)!.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.at(0)).toEqual([false])
  })

  it('uses custom confirmLabel when provided', () => {
    const wrapper = mountDialog({ modelValue: true, message: 'Delete?', confirmLabel: 'Yes, delete' })
    expect(wrapper.text()).toContain('Yes, delete')
  })
})
