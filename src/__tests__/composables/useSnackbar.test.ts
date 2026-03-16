import { describe, it, expect, beforeEach } from 'vitest'
import { snackbar, showSnackbar } from '@/composables/useSnackbar'

beforeEach(() => {
  snackbar.visible = false
  snackbar.message = ''
  snackbar.color = 'success'
})

describe('showSnackbar', () => {
  it('sets visible to true', () => {
    showSnackbar('Hello')
    expect(snackbar.visible).toBe(true)
  })

  it('sets the message', () => {
    showSnackbar('Something saved')
    expect(snackbar.message).toBe('Something saved')
  })

  it('defaults color to success', () => {
    showSnackbar('Done')
    expect(snackbar.color).toBe('success')
  })

  it('accepts a custom color', () => {
    showSnackbar('Error occurred', 'error')
    expect(snackbar.color).toBe('error')
  })
})
