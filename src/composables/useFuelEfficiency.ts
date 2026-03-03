import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { FuelFillup } from '@/types'

export interface EfficiencyResult {
  kmPerLiter: number
  litersPer100km: number
}

export interface FillupWithEfficiency {
  fillup: FuelFillup
  efficiency: EfficiencyResult | null
}

export function computeEfficiencyList(fillups: FuelFillup[]): FillupWithEfficiency[] {
  // fillups must be sorted ASC by odometer_km
  return fillups.map((fillup, i) => {
    if (!fillup.full_tank) return { fillup, efficiency: null }

    // Find most recent prior full-tank fillup
    let j = -1
    for (let k = i - 1; k >= 0; k--) {
      if (fillups[k]?.full_tank) {
        j = k
        break
      }
    }

    if (j === -1) return { fillup, efficiency: null }

    const distance = fillup.odometer_km - fillups[j]!.odometer_km
    if (distance <= 0) return { fillup, efficiency: null }

    // Sum liters from j+1 to i (inclusive)
    let totalLiters = 0
    for (let k = j + 1; k <= i; k++) {
      totalLiters += fillups[k]!.liters
    }

    if (totalLiters <= 0) return { fillup, efficiency: null }

    return {
      fillup,
      efficiency: {
        kmPerLiter: distance / totalLiters,
        litersPer100km: (totalLiters / distance) * 100,
      },
    }
  })
}

export function useFuelEfficiency(fillups: ComputedRef<FuelFillup[]>) {
  return computed(() => computeEfficiencyList(fillups.value))
}
