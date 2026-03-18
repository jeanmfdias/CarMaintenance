import type { MaintenanceCategory } from '@/types'

export interface CsvRow {
  date: string
  description: string
  type: string
  km: string
  value: string
}

export interface ParsedRecord {
  record_date: string
  notes: string
  category: MaintenanceCategory
  odometer_km: number | null
  total_cost: number
}

export interface ImportError {
  row: number
  message: string
  raw: CsvRow
}

export interface ImportResult {
  valid: ParsedRecord[]
  errors: ImportError[]
}

const CATEGORY_MAP: Record<string, MaintenanceCategory> = {
  accessories: 'accessories',
  fix: 'general_repair',
  taxes: 'taxes_fees',
  labor: 'labor',
  preventive: 'scheduled_service',
  insurance: 'insurance',
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n')
  const semicolons = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

function parseDate(raw: string): string | null {
  const trimmed = raw.trim()
  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // BR: DD/MM/YYYY
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`
  return null
}

function parseValue(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Remove currency symbols and spaces (R$, $, etc.)
  let cleaned = trimmed.replace(/[^\d.,]/g, '')

  if (!cleaned) return null

  // Determine decimal separator:
  // If comma is the last separator with exactly 2 digits after → BR format (1.234,56)
  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  if (lastComma > lastDot) {
    // Comma is the decimal separator (BR format): remove dots (thousand sep), replace comma with dot
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // Dot is the decimal separator (standard): remove commas (thousand sep)
    cleaned = cleaned.replace(/,/g, '')
  }

  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseKm(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const cleaned = trimmed.replace(/[^\d]/g, '')
  if (!cleaned) return null
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

export function parseMaintenanceCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  const valid: ParsedRecord[] = []
  const errors: ImportError[] = []

  if (lines.length < 2) return { valid, errors }

  const delimiter = detectDelimiter(lines)
  // Skip header (first line)
  const dataLines = lines.slice(1)

  dataLines.forEach((line, idx) => {
    const rowNumber = idx + 2 // 1-based, after header
    const fields = splitCsvLine(line, delimiter)

    const raw: CsvRow = {
      date: fields[0] ?? '',
      description: fields[1] ?? '',
      type: fields[2] ?? '',
      km: fields[3] ?? '',
      value: fields[4] ?? '',
    }

    // Validate required fields
    if (!raw.date.trim()) {
      errors.push({ row: rowNumber, message: 'Missing date', raw })
      return
    }
    if (!raw.type.trim()) {
      errors.push({ row: rowNumber, message: 'Missing type', raw })
      return
    }
    if (!raw.value.trim()) {
      errors.push({ row: rowNumber, message: 'Missing value', raw })
      return
    }

    // Parse date
    const record_date = parseDate(raw.date)
    if (!record_date) {
      errors.push({ row: rowNumber, message: `Invalid date: "${raw.date}" (use YYYY-MM-DD or DD/MM/YYYY)`, raw })
      return
    }

    // Map service type
    const category = CATEGORY_MAP[raw.type.trim().toLowerCase()]
    if (!category) {
      const valid_types = Object.keys(CATEGORY_MAP).join(', ')
      errors.push({ row: rowNumber, message: `Unknown type: "${raw.type}". Valid: ${valid_types}`, raw })
      return
    }

    // Parse value
    const total_cost = parseValue(raw.value)
    if (total_cost === null) {
      errors.push({ row: rowNumber, message: `Invalid value: "${raw.value}"`, raw })
      return
    }

    // Parse km (optional)
    const odometer_km = parseKm(raw.km)

    valid.push({
      record_date,
      notes: raw.description.trim(),
      category,
      odometer_km,
      total_cost,
    })
  })

  return { valid, errors }
}
