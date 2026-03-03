import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Vehicle, MaintenanceRecord, FuelFillup } from '@/types'
import { computeEfficiencyList } from '@/composables/useFuelEfficiency'

export function exportCsv(filename: string, rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.join(',')
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col] ?? ''
          const str = String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    )
    .join('\n')
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportMaintenanceCsv(vehicle: Vehicle, records: MaintenanceRecord[]) {
  const columns = ['record_date', 'category', 'odometer_km', 'total_cost', 'labor_cost', 'parts_cost', 'notes', 'next_service_date', 'next_service_km']
  exportCsv(`${vehicle.make}_${vehicle.model}_maintenance.csv`, records as unknown as Record<string, unknown>[], columns)
}

export function exportFuelCsv(vehicle: Vehicle, fillups: FuelFillup[]) {
  const columns = ['fillup_date', 'odometer_km', 'liters', 'total_cost', 'price_per_liter', 'fuel_type', 'full_tank', 'notes']
  exportCsv(`${vehicle.make}_${vehicle.model}_fuel.csv`, fillups as unknown as Record<string, unknown>[], columns)
}

export function exportVehicleReport(vehicle: Vehicle, records: MaintenanceRecord[], fillups: FuelFillup[]) {
  const doc = new jsPDF()
  const headerColor: [number, number, number] = [21, 101, 192]

  // Title
  doc.setFontSize(18)
  doc.text(`${vehicle.make} ${vehicle.model} — Maintenance Report`, 14, 22)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)

  // Vehicle summary
  autoTable(doc, {
    startY: 36,
    head: [['Field', 'Value']],
    body: [
      ['Make / Model', `${vehicle.make} ${vehicle.model}`],
      ['Years', `${vehicle.manufacture_year} / ${vehicle.model_year}`],
      ['Fuel type', vehicle.fuel_type],
      ['Odometer', `${vehicle.current_odometer.toLocaleString()} km`],
    ],
    theme: 'grid',
    headStyles: { fillColor: headerColor },
  })

  // Maintenance records
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y1 = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(14)
  doc.text('Maintenance Records', 14, y1)

  autoTable(doc, {
    startY: y1 + 6,
    head: [['Date', 'Category', 'Odometer (km)', 'Total (R$)', 'Notes']],
    body: records.map((r) => [
      r.record_date,
      r.category.replace(/_/g, ' '),
      r.odometer_km ?? '—',
      r.total_cost.toFixed(2),
      r.notes ?? '',
    ]),
    theme: 'striped',
    headStyles: { fillColor: headerColor },
  })

  // Fuel log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y2 = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(14)
  doc.text('Fuel Log', 14, y2)

  const efficiencyList = computeEfficiencyList(fillups)

  autoTable(doc, {
    startY: y2 + 6,
    head: [['Date', 'Odometer (km)', 'Liters', 'Total (R$)', 'R$/L', 'km/L']],
    body: fillups.map((f, i) => {
      const eff = efficiencyList[i]?.efficiency
      return [
        f.fillup_date,
        f.odometer_km.toLocaleString(),
        f.liters.toFixed(3),
        f.total_cost.toFixed(2),
        f.price_per_liter.toFixed(4),
        eff ? eff.kmPerLiter.toFixed(2) : '—',
      ]
    }),
    theme: 'striped',
    headStyles: { fillColor: headerColor },
  })

  doc.save(`${vehicle.make}_${vehicle.model}_report.pdf`)
}
