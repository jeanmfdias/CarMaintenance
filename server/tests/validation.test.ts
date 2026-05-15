import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('zod strict validation', () => {
  it('rejects unknown keys on vehicle POST', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'val-a@example.com')
    const r = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
        __proto__: { polluted: true }, // unknown key
        evil: 'extra',
      })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })

  it('rejects unknown keys on PATCH (defends against mass-assignment)', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'val-b@example.com')
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const id = v.body.id
    const r = await request(app)
      .patch(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 'other-user', id: 'other-id' })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })

  it('rejects an invalid record_date string', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'val-c@example.com')
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const id = v.body.id
    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/maintenance-records`)
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'oil_change', record_date: 'not a date', total_cost: 100 })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })

  it('rejects negative numeric inputs', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'val-d@example.com')
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const id = v.body.id

    const r1 = await request(app)
      .post(`/api/v1/vehicles/${id}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-01-01',
        odometer_km: -1, liters: 1, total_cost: 1,
      })
    expect(r1.status).toBe(400)

    const r2 = await request(app)
      .post(`/api/v1/vehicles/${id}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-01-01',
        odometer_km: 0, liters: 0, total_cost: 1,
      })
    expect(r2.status).toBe(400) // liters must be > 0
  })
})
