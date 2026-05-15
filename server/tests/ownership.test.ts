import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

const baseVehicle = {
  make: 'Toyota',
  model: 'Corolla',
  manufacture_year: 2020,
  model_year: 2021,
  fuel_type: 'flex',
  current_odometer: 10_000,
}

async function setupTwoUsers() {
  const app = makeApp()
  const a = await signInAs(app, 'alice@example.com')
  const b = await signInAs(app, 'bob@example.com')

  const v = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${a.token}`)
    .send(baseVehicle)
  expect(v.status).toBe(201)
  return { app, a, b, vehicleId: v.body.id as string }
}

describe('cross-tenant ownership returns 404 on flat routes', () => {
  it('maintenance: GET / PATCH / DELETE another user’s record is 404', async () => {
    const { app, a, b, vehicleId } = await setupTwoUsers()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/maintenance-records`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ category: 'oil_change', record_date: '2026-01-01', total_cost: 100 })
    expect(create.status).toBe(201)
    const id = create.body.id

    // happy path under owner
    const own = await request(app)
      .get(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${a.token}`)
    expect(own.status).toBe(200)

    const xGet = await request(app)
      .get(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
    expect(xGet.status).toBe(404)

    const xPatch = await request(app)
      .patch(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ notes: 'pwn' })
    expect(xPatch.status).toBe(404)

    const xDel = await request(app)
      .delete(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
    expect(xDel.status).toBe(404)
  })

  it('fuel: cross-tenant GET / PATCH / DELETE returns 404', async () => {
    const { app, a, b, vehicleId } = await setupTwoUsers()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/fuel-fillups`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        fillup_date: '2026-04-01',
        odometer_km: 11_000,
        liters: 40,
        total_cost: 240,
        full_tank: true,
      })
    expect(create.status).toBe(201)
    const id = create.body.id
    for (const method of ['get', 'patch', 'delete'] as const) {
      const r = await request(app)
        [method](`/api/v1/fuel-fillups/${id}`)
        .set('Authorization', `Bearer ${b.token}`)
        .send(method === 'patch' ? { notes: 'x' } : undefined)
      expect(r.status).toBe(404)
    }
  })

  it('odometer-entries: cross-tenant DELETE returns 404', async () => {
    const { app, a, b, vehicleId } = await setupTwoUsers()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/odometer-entries`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ reading_km: 12_345, reading_date: '2026-01-15' })
    expect(create.status).toBe(201)
    const id = create.body.id

    const xDel = await request(app)
      .delete(`/api/v1/odometer-entries/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
    expect(xDel.status).toBe(404)

    // owner can still delete
    const own = await request(app)
      .delete(`/api/v1/odometer-entries/${id}`)
      .set('Authorization', `Bearer ${a.token}`)
    expect(own.status).toBe(204)
  })

  it('insurance: cross-tenant GET / PATCH / DELETE returns 404', async () => {
    const { app, a, b, vehicleId } = await setupTwoUsers()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/insurance-policies`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        insurer: 'Acme',
        start_date: '2026-01-01',
        expiry_date: '2027-01-01',
      })
    expect(create.status).toBe(201)
    const id = create.body.id

    for (const method of ['get', 'patch', 'delete'] as const) {
      const r = await request(app)
        [method](`/api/v1/insurance-policies/${id}`)
        .set('Authorization', `Bearer ${b.token}`)
        .send(method === 'patch' ? { notes: 'x' } : undefined)
      expect(r.status).toBe(404)
    }
  })

  it('service-providers: cross-tenant GET / PATCH / DELETE returns 404', async () => {
    const app = makeApp()
    const a = await signInAs(app, 'a-prov@example.com')
    const b = await signInAs(app, 'b-prov@example.com')

    const create = await request(app)
      .post('/api/v1/service-providers')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ name: 'Joe’s Garage' })
    expect(create.status).toBe(201)
    const id = create.body.id

    for (const method of ['get', 'patch', 'delete'] as const) {
      const r = await request(app)
        [method](`/api/v1/service-providers/${id}`)
        .set('Authorization', `Bearer ${b.token}`)
        .send(method === 'patch' ? { name: 'pwn' } : undefined)
      expect(r.status).toBe(404)
    }
  })

  it('uploads: requests for another user’s file are 403', async () => {
    const app = makeApp()
    const a = await signInAs(app, 'up-a@example.com')
    const b = await signInAs(app, 'up-b@example.com')

    const r = await request(app)
      .get(`/uploads/${a.userId}/some-uuid.jpg`)
      .set('Authorization', `Bearer ${b.token}`)
    expect(r.status).toBe(403)
  })
})
