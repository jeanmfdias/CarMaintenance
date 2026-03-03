import type { MaintenanceCategory } from '@/types'

export const CATEGORY_ICONS: Record<MaintenanceCategory, string> = {
  oil_change: 'mdi-oil',
  tire_service: 'mdi-tire',
  brake_service: 'mdi-car-brake-abs',
  general_repair: 'mdi-wrench',
  scheduled_service: 'mdi-calendar-check',
  taxes_fees: 'mdi-receipt',
  insurance: 'mdi-shield-check',
  labor: 'mdi-account-hard-hat',
  accessories: 'mdi-car-cog',
  fuel: 'mdi-gas-station',
  other: 'mdi-dots-horizontal',
}

export const CATEGORY_COLORS: Record<MaintenanceCategory, string> = {
  oil_change: '#FF6F00',
  tire_service: '#1565C0',
  brake_service: '#B00020',
  general_repair: '#6A1B9A',
  scheduled_service: '#00838F',
  taxes_fees: '#558B2F',
  insurance: '#2E7D32',
  labor: '#E65100',
  accessories: '#4527A0',
  fuel: '#00695C',
  other: '#757575',
}

export const ALL_CATEGORIES: MaintenanceCategory[] = [
  'oil_change', 'tire_service', 'brake_service', 'general_repair',
  'scheduled_service', 'taxes_fees', 'insurance', 'labor',
  'accessories', 'fuel', 'other',
]
