import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { computeEfficiencyList, useFuelEfficiency } from '@/composables/useFuelEfficiency'
import type { FuelFillup } from '@/types'

function makeFillup(overrides: Partial<FuelFillup>): FuelFillup {
  return {
    id: 'f1',
    vehicle_id: 'v1',
    user_id: 'u1',
    fillup_date: '2024-01-01',
    odometer_km: 1000,
    liters: 40,
    total_cost: 200,
    fuel_type: 'gasoline',
    full_tank: true,
    notes: null,
    price_per_liter: 5,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  }
}

describe('computeEfficiencyList', () => {
  it('returns empty array for empty input', () => {
    expect(computeEfficiencyList([])).toEqual([])
  })

  it('returns null efficiency for single full-tank fillup (no prior reference)', () => {
    const fillups = [makeFillup({ id: 'f1', odometer_km: 1000, liters: 40, full_tank: true })]
    const result = computeEfficiencyList(fillups)
    expect(result).toHaveLength(1)
    expect(result[0]!.efficiency).toBeNull()
  })

  it('returns null efficiency for a non-full-tank fillup', () => {
    const fillups = [makeFillup({ id: 'f1', odometer_km: 1000, liters: 20, full_tank: false })]
    const result = computeEfficiencyList(fillups)
    expect(result[0]!.efficiency).toBeNull()
  })

  it('calculates efficiency between two consecutive full-tank fillups', () => {
    const fillups = [
      makeFillup({ id: 'f1', odometer_km: 0, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 500, liters: 50, full_tank: true }),
    ]
    const result = computeEfficiencyList(fillups)
    // f1: no prior full-tank → null
    expect(result[0]!.efficiency).toBeNull()
    // f2: distance = 500, liters = 50 → km/L = 10, L/100km = 10
    expect(result[1]!.efficiency).not.toBeNull()
    expect(result[1]!.efficiency!.kmPerLiter).toBeCloseTo(10)
    expect(result[1]!.efficiency!.litersPer100km).toBeCloseTo(10)
  })

  it('sums liters from partial fillups between two full-tank fillups', () => {
    const fillups = [
      makeFillup({ id: 'f1', odometer_km: 0, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 200, liters: 20, full_tank: false }),
      makeFillup({ id: 'f3', odometer_km: 500, liters: 30, full_tank: true }),
    ]
    const result = computeEfficiencyList(fillups)
    // f3: distance = 500, liters = 20 + 30 = 50 → km/L = 10
    expect(result[2]!.efficiency!.kmPerLiter).toBeCloseTo(10)
    expect(result[2]!.efficiency!.litersPer100km).toBeCloseTo(10)
  })

  it('non-full-tank fillup with full-tank prior gets null efficiency', () => {
    const fillups = [
      makeFillup({ id: 'f1', odometer_km: 0, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 200, liters: 20, full_tank: false }),
    ]
    const result = computeEfficiencyList(fillups)
    expect(result[1]!.efficiency).toBeNull()
  })

  it('returns null when distance is zero', () => {
    const fillups = [
      makeFillup({ id: 'f1', odometer_km: 1000, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 1000, liters: 40, full_tank: true }),
    ]
    const result = computeEfficiencyList(fillups)
    expect(result[1]!.efficiency).toBeNull()
  })

  it('calculates efficiency correctly across multiple full-tank fillups', () => {
    const fillups = [
      makeFillup({ id: 'f1', odometer_km: 0, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 400, liters: 40, full_tank: true }),
      makeFillup({ id: 'f3', odometer_km: 800, liters: 40, full_tank: true }),
    ]
    const result = computeEfficiencyList(fillups)
    expect(result[0]!.efficiency).toBeNull()
    expect(result[1]!.efficiency!.kmPerLiter).toBeCloseTo(10)
    expect(result[2]!.efficiency!.kmPerLiter).toBeCloseTo(10)
  })

  it('preserves fillup reference in result', () => {
    const fillup = makeFillup({ id: 'f1', odometer_km: 1000 })
    const result = computeEfficiencyList([fillup])
    expect(result[0]!.fillup).toBe(fillup)
  })
})

describe('useFuelEfficiency', () => {
  it('returns a computed ref that updates when fillups change', () => {
    const fillups = ref<FuelFillup[]>([
      makeFillup({ id: 'f1', odometer_km: 0, liters: 40, full_tank: true }),
      makeFillup({ id: 'f2', odometer_km: 500, liters: 50, full_tank: true }),
    ])
    const result = useFuelEfficiency(fillups as any)
    expect(result.value).toHaveLength(2)
    expect(result.value[1]!.efficiency!.kmPerLiter).toBeCloseTo(10)
  })
})
