import { reactive } from 'vue'

export const snackbar = reactive({ visible: false, message: '', color: 'success' })

export function showSnackbar(message: string, color = 'success') {
  snackbar.message = message
  snackbar.color = color
  snackbar.visible = true
}
