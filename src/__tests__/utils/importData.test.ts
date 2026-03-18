import { describe, it, expect } from 'vitest'
import { parseMaintenanceCsv } from '@/utils/importData'

const header = 'date,description,type,km,value'

describe('parseMaintenanceCsv', () => {
  it('parses a valid row with all fields', () => {
    const csv = [header, '2024-03-15,Oil change,preventive,45000,250.00'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid).toHaveLength(1)
    expect(valid[0]).toEqual({
      record_date: '2024-03-15',
      notes: 'Oil change',
      category: 'scheduled_service',
      odometer_km: 45000,
      total_cost: 250,
    })
  })

  it('converts BR date format DD/MM/YYYY to ISO', () => {
    const csv = [header, '15/03/2024,Troca de óleo,preventive,45000,250'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid[0].record_date).toBe('2024-03-15')
  })

  it('parses BR currency with thousand separator (1.234,56)', () => {
    const csv = [header, '2024-01-10,Insurance,insurance,,"R$ 1.234,56"'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid[0].total_cost).toBe(1234.56)
  })

  it('parses standard currency with dot decimal (1234.56)', () => {
    const csv = [header, '2024-01-10,Fix brakes,fix,30000,450.75'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid[0].total_cost).toBe(450.75)
  })

  it('maps all service types correctly', () => {
    const types: Record<string, string> = {
      accessories: 'accessories',
      fix: 'general_repair',
      taxes: 'taxes_fees',
      labor: 'labor',
      preventive: 'scheduled_service',
      insurance: 'insurance',
    }
    for (const [csvType, expected] of Object.entries(types)) {
      const csv = [header, `2024-01-01,Test,${csvType},1000,100`].join('\n')
      const { valid, errors } = parseMaintenanceCsv(csv)
      expect(errors, `${csvType} should not produce errors`).toHaveLength(0)
      expect(valid[0].category, `${csvType} should map to ${expected}`).toBe(expected)
    }
  })

  it('handles type matching case-insensitively', () => {
    const csv = [header, '2024-01-01,Oil,PREVENTIVE,0,100'].join('\n')
    const { valid } = parseMaintenanceCsv(csv)
    expect(valid[0].category).toBe('scheduled_service')
  })

  it('returns error row for unknown service type', () => {
    const csv = [header, '2024-01-01,Unknown service,repair,10000,100'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(valid).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].row).toBe(2)
    expect(errors[0].message).toContain('Unknown type')
  })

  it('returns error row for missing date', () => {
    const csv = [header, ',Oil change,preventive,45000,250'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toContain('date')
  })

  it('returns error row for missing value', () => {
    const csv = [header, '2024-01-01,Oil,preventive,45000,'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toContain('value')
  })

  it('returns error row for invalid date format', () => {
    const csv = [header, '01-03-2024,Oil,preventive,45000,250'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(valid).toHaveLength(0)
    expect(errors[0].message).toContain('Invalid date')
  })

  it('treats empty km as null', () => {
    const csv = [header, '2024-01-01,Insurance,insurance,,500'].join('\n')
    const { valid } = parseMaintenanceCsv(csv)
    expect(valid[0].odometer_km).toBeNull()
  })

  it('parses semicolon-delimited file', () => {
    const csv = ['date;description;type;km;value', '2024-01-01;Oil change;preventive;45000;250,00'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid[0].category).toBe('scheduled_service')
    expect(valid[0].total_cost).toBe(250)
  })

  it('skips empty lines silently', () => {
    const csv = [header, '', '2024-01-01,Oil,preventive,45000,250', '', '2024-02-01,Tax,taxes,0,300'].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(errors).toHaveLength(0)
    expect(valid).toHaveLength(2)
  })

  it('returns empty result for file with only a header', () => {
    const { valid, errors } = parseMaintenanceCsv(header)
    expect(valid).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  it('mixes valid and error rows and returns both', () => {
    const csv = [
      header,
      '2024-01-01,Good row,preventive,1000,100',
      '2024-01-02,Bad type,unknown,1000,100',
      '2024-01-03,Another good,fix,2000,200',
    ].join('\n')
    const { valid, errors } = parseMaintenanceCsv(csv)
    expect(valid).toHaveLength(2)
    expect(errors).toHaveLength(1)
  })
})
