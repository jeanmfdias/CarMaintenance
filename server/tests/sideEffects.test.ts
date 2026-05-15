import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('odometer mirroring side-effects', () => {
  it('maintenance create with odometer_km mirrors an odometer_entries row and bumps vehicle.current_odometer', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'mirror1@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Honda', model: 'Fit',
        manufacture_year: 2018, model_year: 2018,
        fuel_type: 'flex', current_odometer: 50_000,
      })
    const vid = v.body.id

    const m = await request(app)
      .post(`/api/v1/vehicles/${vid}/maintenance-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'oil_change',
        record_date: '2026-05-01',
        odometer_km: 60_000,
        total_cost: 200,
      })
    expect(m.status).toBe(201)

    const odo = await request(app)
      .get(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
    expect(odo.status).toBe(200)
    expect(odo.body).toHaveLength(1)
    expect(odo.body[0].reading_km).toBe(60_000)
    expect(odo.body[0].reading_date).toBe('2026-05-01')

    const after = await request(app)
      .get(`/api/v1/vehicles/${vid}`)
      .set('Authorization', `Bearer ${token}`)
    expect(after.body.current_odometer).toBe(60_000)
  })

  it('maintenance create without odometer_km does NOT create an odometer entry', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'mirror2@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Honda', model: 'Fit',
        manufacture_year: 2018, model_year: 2018,
        fuel_type: 'flex', current_odometer: 50_000,
      })
    const vid = v.body.id

    const m = await request(app)
      .post(`/api/v1/vehicles/${vid}/maintenance-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'oil_change', record_date: '2026-05-01', total_cost: 200 })
    expect(m.status).toBe(201)

    const odo = await request(app)
      .get(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
    expect(odo.body).toHaveLength(0)
  })

  it('mirror dedupes against an existing entry at the same date+km', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'mirror3@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Honda', model: 'Fit',
        manufacture_year: 2018, model_year: 2018,
        fuel_type: 'flex', current_odometer: 0,
      })
    const vid = v.body.id

    // Manual entry first
    const e1 = await request(app)
      .post(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_km: 60_000, reading_date: '2026-05-01' })
    expect(e1.status).toBe(201)

    // Fuel fillup at the SAME date+km should NOT add a duplicate.
    const f = await request(app)
      .post(`/api/v1/vehicles/${vid}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-05-01',
        odometer_km: 60_000,
        liters: 40, total_cost: 240,
        full_tank: true,
      })
    expect(f.status).toBe(201)

    const odo = await request(app)
      .get(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
    expect(odo.body).toHaveLength(1)
  })

  it('fuel: price_per_liter is computed and zero-volume is rejected at validation', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'mirror4@example.com')
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const vid = v.body.id

    const ok = await request(app)
      .post(`/api/v1/vehicles/${vid}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-01-01',
        odometer_km: 100, liters: 20, total_cost: 100,
      })
    expect(ok.status).toBe(201)
    expect(ok.body.price_per_liter).toBeCloseTo(5, 4)

    const bad = await request(app)
      .post(`/api/v1/vehicles/${vid}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-01-01',
        odometer_km: 100, liters: 0, total_cost: 0,
      })
    expect(bad.status).toBe(400)
  })
})

describe('health endpoints', () => {
  it('GET /health is a cheap liveness probe', async () => {
    const app = makeApp()
    const r = await request(app).get('/health')
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('ok')
    expect(typeof r.body.version).toBe('string')
  })

  it('GET /ready verifies DB reachability', async () => {
    const app = makeApp()
    const r = await request(app).get('/ready')
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('ok')
    expect(r.body.db).toBe('ok')
  })

  it('GET /api/v1/version returns a version string', async () => {
    const app = makeApp()
    const r = await request(app).get('/api/v1/version')
    expect(r.status).toBe(200)
    expect(typeof r.body.version).toBe('string')
  })
})
