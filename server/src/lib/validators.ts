import { z } from 'zod'

/**
 * Accepts either a date-only ISO string (`YYYY-MM-DD`) or a full ISO 8601
 * timestamp. Returns the original string on success. We don't normalize the
 * shape because existing Supabase-imported rows use both forms.
 */
export const isoDateLike = z
  .string()
  .min(8)
  .refine(
    (s) => {
      // Quick shape filters before falling back to Date parsing.
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s + 'T00:00:00Z')
        return !Number.isNaN(d.getTime())
      }
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        const d = new Date(s)
        return !Number.isNaN(d.getTime())
      }
      return false
    },
    { message: 'must be an ISO 8601 date (YYYY-MM-DD) or timestamp' }
  )

/** UUID v1-v5 (zod's `.uuid()` is stricter but we have legacy data). */
export const uuidLike = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, {
  message: 'must be a UUID',
})
