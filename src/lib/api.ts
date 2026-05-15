/**
 * Typed fetch-based API client for the CarMaintenance backend.
 *
 * Singleton, no Pinia dependency. Stores call methods on the exported `api`
 * object — never `fetch` directly.
 *
 * Threat model — token storage
 * ----------------------------
 * The bearer JWT is persisted in localStorage under `carm.access_token`.
 * That makes the token vulnerable to exfiltration via XSS: anything that
 * runs in this origin's JS context (an injected `<script>`, a compromised
 * third-party dep, a malicious Vue template binding) can read it.
 *
 * Mitigations baked into the rest of the codebase:
 *  - No `v-html` / `innerHTML` is used anywhere with user input.
 *  - No untrusted third-party CDN scripts. All deps come from npm + the
 *    build's own bundle.
 *  - No inline scripts in index.html.
 *  - The backend sets a strict CSP via helmet.
 *
 * Future hardening (requires backend coordination, NOT done here):
 *  - Move auth to an HttpOnly cookie set by the backend on /auth/verify;
 *    drop this localStorage path. Until then, XSS = token compromise.
 */

import type {
  Vehicle,
  VehicleInsert,
  VehicleUpdate,
  OdometerEntry,
  OdometerEntryInsert,
  MaintenanceRecord,
  MaintenanceRecordInsert,
  MaintenanceRecordUpdate,
  FuelFillup,
  FuelFillupInsert,
  FuelFillupUpdate,
  InsurancePolicy,
  InsurancePolicyInsert,
  InsurancePolicyUpdate,
  ServiceProvider,
  ServiceProviderInsert,
  ServiceProviderUpdate,
  UserSettings,
} from '@/types'

const TOKEN_STORAGE_KEY = 'carm.access_token'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  '/api/v1'

export interface AuthUser {
  id: string
  email: string
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Register a callback invoked whenever a request returns 401.
 * Used by the auth store on init() to wire in a redirect/logout.
 */
export function onUnauthorized(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

// ---- Token management ------------------------------------------------------

function readTokenFromStorage(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

let accessToken: string | null = readTokenFromStorage()

export function getToken(): string | null {
  return accessToken
}

export function setToken(token: string): void {
  accessToken = token
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // ignore — fall back to in-memory token
  }
}

export function clearToken(): void {
  accessToken = null
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ---- Core request helpers --------------------------------------------------

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** Set true when sending FormData — skip JSON content-type. */
  raw?: boolean
  /** Return Response for callers that need streaming/blob. */
  asResponse?: boolean
}

function buildUrl(path: string): string {
  if (path.startsWith('http')) return path
  if (path.startsWith('/')) return `${BASE_URL}${path}`
  return `${BASE_URL}/${path}`
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (!opts.raw && opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    headers,
  }
  if (opts.body !== undefined) {
    init.body = opts.raw ? (opts.body as BodyInit) : JSON.stringify(opts.body)
  }

  const res = await fetch(buildUrl(path), init)

  if (res.status === 401) {
    clearToken()
    if (unauthorizedHandler) {
      try {
        unauthorizedHandler()
      } catch {
        // ignore handler errors
      }
    }
  }

  if (opts.asResponse) {
    if (!res.ok) {
      throw await readError(res)
    }
    return res as unknown as T
  }

  if (res.status === 204) {
    return undefined as T
  }

  if (!res.ok) {
    throw await readError(res)
  }

  // Some endpoints return empty 200 bodies — guard JSON parse.
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

async function readError(res: Response): Promise<ApiError> {
  let code = 'unknown_error'
  let message = res.statusText || `Request failed with status ${res.status}`
  try {
    const text = await res.text()
    if (text) {
      const body = JSON.parse(text) as { error?: { code?: string; message?: string } }
      if (body?.error) {
        code = body.error.code ?? code
        message = body.error.message ?? message
      }
    }
  } catch {
    // ignore parse errors — fall back to statusText
  }
  return new ApiError(res.status, code, message)
}

// ---- Resource APIs ---------------------------------------------------------

const auth = {
  async sendMagicLink(email: string): Promise<void> {
    await request('/auth/magic-link', { method: 'POST', body: { email } })
  },
  async verify(token: string): Promise<{ access_token: string; user: AuthUser }> {
    return request<{ access_token: string; user: AuthUser }>('/auth/verify', {
      method: 'POST',
      body: { token },
    })
  },
  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' })
    } catch {
      // best-effort: ignore network errors on logout
    }
  },
  async me(): Promise<AuthUser> {
    const res = await request<{ user: AuthUser }>('/auth/me')
    return res.user
  },
}

const vehicles = {
  list: () => request<Vehicle[]>('/vehicles'),
  get: (id: string) => request<Vehicle>(`/vehicles/${id}`),
  create: (payload: Omit<VehicleInsert, 'photo_url'> & { photo_url?: string | null }) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: payload }),
  update: (id: string, payload: VehicleUpdate) =>
    request<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => request<void>(`/vehicles/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: string, file: File): Promise<Vehicle> => {
    const fd = new FormData()
    fd.append('file', file)
    return request<Vehicle>(`/vehicles/${id}/photo`, { method: 'POST', body: fd, raw: true })
  },
  removePhoto: (id: string) => request<Vehicle>(`/vehicles/${id}/photo`, { method: 'DELETE' }),
  /**
   * Resolve a `photo_url` (relative path returned by the server) into a
   * displayable URL for `<img>` / `<v-img>`.
   *
   * The backend gates `/uploads/*` behind the bearer token, so we fetch the
   * file with auth and return a blob: object URL. Caller is responsible for
   * revoking the URL via `URL.revokeObjectURL` when done if memory matters.
   */
  async photoUrl(photoPath: string | null | undefined): Promise<string | null> {
    if (!photoPath) return null
    // photo_url is something like /uploads/<userId>/<vehicleId>.jpg.
    // It is NOT under /api/v1 — uploads are mounted at the server root.
    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    const res = await fetch(photoPath, { headers })
    if (!res.ok) {
      if (res.status === 401) {
        clearToken()
        unauthorizedHandler?.()
      }
      throw new ApiError(res.status, 'photo_fetch_failed', 'Failed to load photo')
    }
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },
}

const odometer = {
  listByVehicle: (vehicleId: string) =>
    request<OdometerEntry[]>(`/vehicles/${vehicleId}/odometer-entries`),
  create: (vehicleId: string, payload: Omit<OdometerEntryInsert, 'vehicle_id'>) =>
    request<OdometerEntry>(`/vehicles/${vehicleId}/odometer-entries`, {
      method: 'POST',
      body: payload,
    }),
  remove: (id: string) => request<void>(`/odometer-entries/${id}`, { method: 'DELETE' }),
}

const maintenance = {
  listByVehicle: (vehicleId: string) =>
    request<MaintenanceRecord[]>(`/vehicles/${vehicleId}/maintenance-records`),
  get: (id: string) => request<MaintenanceRecord>(`/maintenance-records/${id}`),
  create: (vehicleId: string, payload: Omit<MaintenanceRecordInsert, 'vehicle_id'>) =>
    request<MaintenanceRecord>(`/vehicles/${vehicleId}/maintenance-records`, {
      method: 'POST',
      body: payload,
    }),
  update: (id: string, payload: MaintenanceRecordUpdate) =>
    request<MaintenanceRecord>(`/maintenance-records/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => request<void>(`/maintenance-records/${id}`, { method: 'DELETE' }),
}

const fuel = {
  listByVehicle: (vehicleId: string) =>
    request<FuelFillup[]>(`/vehicles/${vehicleId}/fuel-fillups`),
  get: (id: string) => request<FuelFillup>(`/fuel-fillups/${id}`),
  create: (vehicleId: string, payload: Omit<FuelFillupInsert, 'vehicle_id'>) =>
    request<FuelFillup>(`/vehicles/${vehicleId}/fuel-fillups`, { method: 'POST', body: payload }),
  update: (id: string, payload: FuelFillupUpdate) =>
    request<FuelFillup>(`/fuel-fillups/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => request<void>(`/fuel-fillups/${id}`, { method: 'DELETE' }),
}

const insurance = {
  listByVehicle: (vehicleId: string) =>
    request<InsurancePolicy[]>(`/vehicles/${vehicleId}/insurance-policies`),
  get: (id: string) => request<InsurancePolicy>(`/insurance-policies/${id}`),
  create: (vehicleId: string, payload: Omit<InsurancePolicyInsert, 'vehicle_id'>) =>
    request<InsurancePolicy>(`/vehicles/${vehicleId}/insurance-policies`, {
      method: 'POST',
      body: payload,
    }),
  update: (id: string, payload: InsurancePolicyUpdate) =>
    request<InsurancePolicy>(`/insurance-policies/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => request<void>(`/insurance-policies/${id}`, { method: 'DELETE' }),
}

const providers = {
  list: () => request<ServiceProvider[]>('/service-providers'),
  get: (id: string) => request<ServiceProvider>(`/service-providers/${id}`),
  create: (payload: ServiceProviderInsert) =>
    request<ServiceProvider>('/service-providers', { method: 'POST', body: payload }),
  update: (id: string, payload: ServiceProviderUpdate) =>
    request<ServiceProvider>(`/service-providers/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => request<void>(`/service-providers/${id}`, { method: 'DELETE' }),
}

const settings = {
  get: () => request<UserSettings>('/settings'),
  update: (payload: Partial<Pick<UserSettings, 'locale' | 'default_reminder_lead_days'>>) =>
    request<UserSettings>('/settings', { method: 'PUT', body: payload }),
}

/**
 * Probe the backend's reachability. Hits `/health` (NOT under `/api/v1`).
 * Returns true on a 2xx; false on any network error or non-2xx response.
 */
async function health(): Promise<boolean> {
  try {
    // /health lives at the server root, not under /api/v1.
    const root = BASE_URL.replace(/\/api\/v\d+\/?$/, '')
    const url = `${root || ''}/health`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

export const api = {
  auth,
  vehicles,
  odometer,
  maintenance,
  fuel,
  insurance,
  providers,
  settings,
  health,
}

export default api
