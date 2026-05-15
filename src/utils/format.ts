import { i18n } from '@/plugins/i18n'

/**
 * Centralized formatters that pick up the active i18n locale. Currency stays
 * BRL regardless of locale — the app is single-currency.
 *
 * Use these everywhere instead of ad-hoc `value.toLocaleString('pt-BR', …)`
 * calls so a future locale switch doesn't leave half the UI in the wrong
 * formatting.
 */

function activeLocale(): string {
  const loc = i18n.global.locale
  // vue-i18n v9 composition mode: locale is a Ref
  return (typeof loc === 'object' && loc !== null && 'value' in loc ? loc.value : loc) as string
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(activeLocale(), {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Formats a kilometer count, e.g. 12345 → "12,345" or "12.345". */
export function formatKm(value: number): string {
  return new Intl.NumberFormat(activeLocale()).format(value)
}

/** ISO date string ("2026-05-11") → localized long form. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  // Parse as local date (avoid TZ shift from new Date('YYYY-MM-DD') which is UTC).
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat(activeLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(y, m - 1, d))
}

/** ISO date string → short month/year label for charts. */
export function formatMonthShort(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  if (!y || !m) return iso
  return new Intl.DateTimeFormat(activeLocale(), { month: 'short', year: '2-digit' }).format(
    new Date(y, m - 1, 1),
  )
}
