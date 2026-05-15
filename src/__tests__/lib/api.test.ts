import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  api,
  ApiError,
  getToken,
  setToken,
  clearToken,
  onUnauthorized,
} from '@/lib/api'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  clearToken()
  onUnauthorized(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api — token storage', () => {
  it('persists tokens via setToken / getToken / clearToken', () => {
    expect(getToken()).toBeNull()
    setToken('abc')
    expect(getToken()).toBe('abc')
    expect(localStorage.getItem('carm.access_token')).toBe('abc')
    clearToken()
    expect(getToken()).toBeNull()
    expect(localStorage.getItem('carm.access_token')).toBeNull()
  })
})

describe('api — request behavior', () => {
  it('builds GET URLs with the configured base path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    await api.vehicles.list()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/vehicles')
    expect((init as RequestInit).method).toBe('GET')
  })

  it('serializes JSON POST bodies and sets content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await api.auth.sendMagicLink('user@example.com')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/auth/magic-link')
    expect((init as RequestInit).method).toBe('POST')
    const body = (init as RequestInit).body as string
    expect(JSON.parse(body)).toEqual({ email: 'user@example.com' })
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('injects Authorization header when a token is set', async () => {
    setToken('jwt-123')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)
    await api.vehicles.list()
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer jwt-123')
  })

  it('clears the token and invokes the unauthorized handler on 401', async () => {
    setToken('expired')
    const handler = vi.fn()
    onUnauthorized(handler)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(401, { error: { code: 'unauthorized', message: 'expired' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.vehicles.list()).rejects.toBeInstanceOf(ApiError)
    expect(getToken()).toBeNull()
    expect(handler).toHaveBeenCalled()
  })

  it('throws an ApiError with status and code on non-2xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(404, { error: { code: 'not_found', message: 'gone' } }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await api.vehicles.get('missing')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      const err = e as ApiError
      expect(err.status).toBe(404)
      expect(err.code).toBe('not_found')
      expect(err.message).toBe('gone')
    }
  })

  it('returns undefined for 204 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await api.vehicles.remove('v1')
    expect(result).toBeUndefined()
  })

  it('maps a structured 4xx error body to ApiError.code and .message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(422, { error: { code: 'validation', message: 'bad payload' } }))
    vi.stubGlobal('fetch', fetchMock)
    const err = await api.vehicles.create({} as never).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(422)
    expect((err as ApiError).code).toBe('validation')
    expect((err as ApiError).message).toBe('bad payload')
  })

  it('falls back to status text when the error body is not JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('plain text', { status: 500, statusText: 'oops' }))
    vi.stubGlobal('fetch', fetchMock)
    const err = await api.vehicles.list().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(500)
    expect((err as ApiError).code).toBe('unknown_error')
    expect((err as ApiError).message).toBe('oops')
  })
})

describe('api — vehicles photo', () => {
  it('sends a multipart upload (FormData) without forcing application/json', async () => {
    setToken('jwt')
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 'v1', photo_url: '/uploads/u/v1.jpg' }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    await api.vehicles.uploadPhoto('v1', file)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/vehicles/v1/photo')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    expect(headers['Authorization']).toBe('Bearer jwt')
  })

  it('fetches a bearer-gated photo and returns a blob: URL', async () => {
    setToken('jwt-img')
    const blob = new Blob(['png-bytes'], { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const fakeBlobUrl = 'blob:http://localhost/abc'
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(fakeBlobUrl)
    const out = await api.vehicles.photoUrl('/uploads/u/v1.jpg')
    expect(out).toBe(fakeBlobUrl)
    const [url, init] = fetchMock.mock.calls[0]!
    // photo paths are NOT under /api/v1 — verify we hit the path as-is.
    expect(url).toBe('/uploads/u/v1.jpg')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer jwt-img')
    createSpy.mockRestore()
  })

  it('returns null for empty photo paths', async () => {
    const out = await api.vehicles.photoUrl(null)
    expect(out).toBeNull()
  })

  it('throws an ApiError when the photo cannot be fetched', async () => {
    setToken('jwt-img')
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.vehicles.photoUrl('/uploads/u/missing.jpg')).rejects.toBeInstanceOf(ApiError)
  })
})
