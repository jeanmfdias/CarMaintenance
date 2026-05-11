import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

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

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true)
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          return cb(null, true)
        }
        return cb(new Error(`Origin ${origin} not allowed by CORS`))
      },
      credentials: true,
    })
  )

  app.use(express.json({ limit: '1mb' }))

  if (config.nodeEnv === 'test') {
    // silent
  } else if (config.isProd) {
    app.use(morgan('combined'))
  } else {
    app.use(morgan('dev'))
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // API
  const api = express.Router()
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
  app.use(errorHandler)

  return app
}
