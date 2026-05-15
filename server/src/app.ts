import express, { type Express, type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config.js'
import { getDb } from './db/index.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { requestId } from './middleware/requestId.js'
import { noStore } from './middleware/cacheControl.js'
import { apiLimiter } from './middleware/rateLimit.js'

import authRouter from './routes/auth.js'
import vehiclesRouter from './routes/vehicles.js'
import providersRouter from './routes/providers.js'
import settingsRouter from './routes/settings.js'
import uploadsRouter from './routes/uploads.js'
import { odometerNestedRouter, odometerFlatRouter } from './routes/odometer.js'
import { maintenanceNestedRouter, maintenanceFlatRouter } from './routes/maintenance.js'
import { fuelNestedRouter, fuelFlatRouter } from './routes/fuel.js'
import { insuranceNestedRouter, insuranceFlatRouter } from './routes/insurance.js'

export function createApp(): Express {
  const app = express()

  // x-powered-by removed (helmet does this by default, but make it explicit).
  app.disable('x-powered-by')

  // Trust-proxy is required for correct req.ip behind nginx; configurable.
  if (config.trustProxy !== false) {
    app.set('trust proxy', config.trustProxy)
  }

  app.use(
    helmet({
      // Allow assets (vehicle photos served from /uploads) to be loaded
      // cross-origin by the SPA running on a different port/host.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // API responses are JSON, not HTML — CSP is mostly noise here. Disable
      // it to avoid breaking any non-HTML content negotiation, and rely on
      // the SPA's own CSP for the user-facing surface.
      contentSecurityPolicy: false,
      // HSTS is only meaningful behind HTTPS. The reverse-proxy may set it;
      // don't double-send a wrong max-age from the app.
      hsts: config.isProd ? undefined : false,
    })
  )

  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header (server-to-server, curl, healthcheck) — allow.
        if (!origin) return cb(null, true)
        // Explicit "null" string Origin is sent by sandboxed iframes / file://
        // — reject unless explicitly allow-listed.
        if (origin === 'null' && !config.corsOrigins.includes('null')) {
          return cb(new Error('Origin "null" not allowed by CORS'))
        }
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          return cb(null, true)
        }
        return cb(new Error(`Origin ${origin} not allowed by CORS`))
      },
      credentials: true,
    })
  )

  app.use(express.json({ limit: config.bodyLimit }))

  // Assign req.id and X-Request-ID before any logging so log lines correlate
  // with response headers.
  app.use(requestId)

  if (config.nodeEnv === 'test') {
    // silent
  } else if (config.isProd) {
    // Structured one-line JSON per request. Cheap, no extra dependency.
    morgan.token('id', (req) => (req as Request).id ?? '-')
    morgan.token('uid', (req) => ((req as Request).user?.id ?? '-'))
    app.use(
      morgan((tokens, req, res) => {
        return JSON.stringify({
          time: new Date().toISOString(),
          level: 'info',
          msg: 'request',
          rid: tokens.id?.(req, res) ?? '-',
          uid: tokens.uid?.(req, res) ?? '-',
          method: tokens.method?.(req, res),
          path: tokens.url?.(req, res),
          status: Number(tokens.status?.(req, res) ?? 0),
          ms: Number(tokens['response-time']?.(req, res) ?? 0),
          len: tokens.res?.(req, res, 'content-length') ?? '-',
          ua: tokens['user-agent']?.(req, res) ?? '-',
        })
      })
    )
  } else {
    app.use(morgan('dev'))
  }

  // Cheap liveness: process is up. No DB or downstream pings — used by
  // load balancers / orchestrators that want a fast "am I serving" probe.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: config.version })
  })

  // Readiness: process up AND the SQLite file is reachable. Docker's
  // healthcheck wants this — flips the container red if the DB went away.
  app.get('/ready', (_req, res) => {
    try {
      const row = getDb().prepare('SELECT 1 AS ok').get() as { ok: number } | undefined
      if (row?.ok !== 1) throw new Error('db check returned no row')
      res.json({ status: 'ok', db: 'ok', version: config.version })
    } catch (e) {
      res
        .status(503)
        .json({ status: 'unavailable', db: 'error', message: (e as Error).message })
    }
  })

  // /version — handy for confirming what's running after a deploy.
  app.get('/version', (_req, res) => {
    res.json({ version: config.version })
  })

  // API
  const api = express.Router()
  // Authed (and auth) responses should not be cached by SW or intermediaries.
  api.use(noStore)
  // Global per-IP rate limit. Tight per-endpoint limits live on the auth routes.
  api.use(apiLimiter)
  api.get('/version', (_req, res) => res.json({ version: config.version }))
  api.use('/auth', authRouter)
  api.use('/vehicles', vehiclesRouter)
  api.use('/vehicles/:id/odometer-entries', odometerNestedRouter)
  api.use('/odometer-entries', odometerFlatRouter)
  api.use('/vehicles/:id/maintenance-records', maintenanceNestedRouter)
  api.use('/maintenance-records', maintenanceFlatRouter)
  api.use('/vehicles/:id/fuel-fillups', fuelNestedRouter)
  api.use('/fuel-fillups', fuelFlatRouter)
  api.use('/vehicles/:id/insurance-policies', insuranceNestedRouter)
  api.use('/insurance-policies', insuranceFlatRouter)
  api.use('/service-providers', providersRouter)
  api.use('/settings', settingsRouter)

  app.use('/api/v1', api)
  app.use('/uploads', uploadsRouter)

  app.use(notFoundHandler)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    errorHandler(err, req, res, next)
  })

  return app
}
