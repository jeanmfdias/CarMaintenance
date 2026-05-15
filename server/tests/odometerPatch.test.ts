import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('odometer PATCH /odometer-entries/:id', () => {
  it('updates reading_km/date/notes and bumps vehicle.current_odometer when higher', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'odo-patch@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const vid = v.body.id

    const e = await request(app)
      .post(`/api/v1/vehicles/${vid}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_km: 100, reading_date: '2026-01-01' })
    const id = e.body.id

    const p = await request(app)
      .patch(`/api/v1/odometer-entries/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_km: 500, notes: 'corrected' })
    expect(p.status).toBe(200)
    expect(p.body.reading_km).toBe(500)
    expect(p.body.notes).toBe('corrected')

    const vAfter = await request(app)
      .get(`/api/v1/vehicles/${vid}`)
      .set('Authorization', `Bearer ${token}`)
    expect(vAfter.body.current_odometer).toBe(500)
  })

  it('rejects unknown keys (mass-assignment defense)', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'odo-patch2@example.com')
    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const e = await request(app)
      .post(`/api/v1/vehicles/${v.body.id}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reading_km: 100, reading_date: '2026-01-01' })
    const r = await request(app)
      .patch(`/api/v1/odometer-entries/${e.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: 'other', id: 'other' })
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })

  it('cross-tenant PATCH returns 404', async () => {
    const app = makeApp()
    const a = await signInAs(app, 'odo-a@example.com')
    const b = await signInAs(app, 'odo-b@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        make: 'X', model: 'Y',
        manufacture_year: 2020, model_year: 2020,
        fuel_type: 'gasoline', current_odometer: 0,
      })
    const e = await request(app)
      .post(`/api/v1/vehicles/${v.body.id}/odometer-entries`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ reading_km: 1234, reading_date: '2026-02-02' })

    const r = await request(app)
      .patch(`/api/v1/odometer-entries/${e.body.id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ reading_km: 9999 })
    expect(r.status).toBe(404)
  })
})
