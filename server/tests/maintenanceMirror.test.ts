import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

/**
 * The frontend agent removed its client-side odometer mirror on maintenance
 * create. Pin the server-side behavior so we don't silently regress.
 */
describe('maintenance odometer mirror (server-side rule)', () => {
  async function setup() {
    const app = makeApp()
    const { token } = await signInAs(app, `maint-mirror-${Date.now()}@example.com`)
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 1_000,
      })
    return { app, token, vid: v.body.id as string }
  }

  it('does NOT bump vehicle.current_odometer when the new reading is lower', async () => {
    const { app, token, vid } = await setup()
    const r = await request(app)
      .post(`/api/v1/vehicles/${vid}/maintenance-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'oil_change',
        record_date: '2026-05-01',
        odometer_km: 500, // lower than current_odometer=1000
        total_cost: 100,
      })
    expect(r.status).toBe(201)

    const v = await request(app)
      .get(`/api/v1/vehicles/${vid}`)
      .set('Authorization', `Bearer ${token}`)
    // unchanged
    expect(v.body.current_odometer).toBe(1_000)

    // mirror entry still created (history is history, even if it's older)
    const odo = await request(app)
      .get(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
    expect(odo.body).toHaveLength(1)
    expect(odo.body[0].reading_km).toBe(500)
  })

  it('rejects a negative total_cost', async () => {
    const { app, token, vid } = await setup()
    const r = await request(app)
      .post(`/api/v1/vehicles/${vid}/maintenance-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'oil_change', record_date: '2026-05-01', total_cost: -1 })
    expect(r.status).toBe(400)
  })
})
