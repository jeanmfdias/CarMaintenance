import { describe, it, expect } from 'vitest'
import { ALL_CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/utils/maintenanceCategories'

describe('maintenanceCategories', () => {
  it('ALL_CATEGORIES contains all 11 categories', () => {
    expect(ALL_CATEGORIES).toHaveLength(11)
  })

  it('ALL_CATEGORIES contains the expected categories', () => {
    expect(ALL_CATEGORIES).toContain('oil_change')
    expect(ALL_CATEGORIES).toContain('tire_service')
    expect(ALL_CATEGORIES).toContain('brake_service')
    expect(ALL_CATEGORIES).toContain('general_repair')
    expect(ALL_CATEGORIES).toContain('scheduled_service')
    expect(ALL_CATEGORIES).toContain('taxes_fees')
    expect(ALL_CATEGORIES).toContain('insurance')
    expect(ALL_CATEGORIES).toContain('labor')
    expect(ALL_CATEGORIES).toContain('accessories')
    expect(ALL_CATEGORIES).toContain('fuel')
    expect(ALL_CATEGORIES).toContain('other')
  })

  it('every category has an icon', () => {
    ALL_CATEGORIES.forEach((cat) => {
      expect(CATEGORY_ICONS[cat]).toBeTruthy()
    })
  })

  it('every category has a color', () => {
    ALL_CATEGORIES.forEach((cat) => {
      expect(CATEGORY_COLORS[cat]).toBeTruthy()
    })
  })

  it('CATEGORY_ICONS keys match ALL_CATEGORIES', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual([...ALL_CATEGORIES].sort())
  })

  it('CATEGORY_COLORS keys match ALL_CATEGORIES', () => {
    expect(Object.keys(CATEGORY_COLORS).sort()).toEqual([...ALL_CATEGORIES].sort())
  })

  it('colors are valid hex values', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    ALL_CATEGORIES.forEach((cat) => {
      expect(CATEGORY_COLORS[cat]).toMatch(hexPattern)
    })
  })
})
