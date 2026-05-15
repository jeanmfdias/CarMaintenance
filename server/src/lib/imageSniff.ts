/**
 * Lightweight magic-byte sniffing for the three image formats we accept on
 * upload (jpeg, png, webp). We do this in-process to avoid the heavy
 * `file-type` dependency and its ESM-only quirks; the magic numbers below
 * are stable and well-documented.
 *
 * Returns the canonical mime type ('image/jpeg' | 'image/png' | 'image/webp')
 * if the buffer matches, otherwise null. Trust the *result*, never the
 * client-supplied Content-Type.
 */
export function sniffImageMime(buf: Buffer | undefined | null): string | null {
  if (!buf || buf.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png'
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg'
  }

  // WebP: 'RIFF' .... 'WEBP'
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}
