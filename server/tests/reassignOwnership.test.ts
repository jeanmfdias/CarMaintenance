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

/**
 * Broken-access-control regression tests: a user must not be able to relink
 * their own record to a vehicle / service provider owned by another user.
 * The referenced FK target has to belong to the caller; otherwise the API
 * responds 404 (existence of others' rows stays hidden) and the row is left
 * unchanged.
 */
async function setup() {
  const app = makeApp()
  const a = await signInAs(app, 'alice@example.com')
  const b = await signInAs(app, 'bob@example.com')

  const va = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${a.token}`)
    .send(baseVehicle)
  expect(va.status).toBe(201)

  const vb = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${b.token}`)
    .send(baseVehicle)
  expect(vb.status).toBe(201)

  return { app, a, b, vehicleA: va.body.id as string, vehicleB: vb.body.id as string }
}

describe('maintenance PATCH cannot reassign to another user’s vehicle/provider', () => {
  it('rejects vehicle_id owned by another user with 404 and leaves the row unchanged', async () => {
    const { app, a, b, vehicleA, vehicleB } = await setup()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/maintenance-records`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ category: 'oil_change', record_date: '2026-01-01', total_cost: 100 })
    expect(create.status).toBe(201)
    const id = create.body.id

    const patch = await request(app)
      .patch(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ vehicle_id: vehicleB })
    expect(patch.status).toBe(404)

    // Untouched: still points at the original vehicle.
    const after = await request(app)
      .get(`/api/v1/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${a.token}`)
    expect(after.status).toBe(200)
    expect(after.body.vehicle_id).toBe(vehicleA)
  })

  it('rejects service_provider_id owned by another user with 404', async () => {
    const { app, a, b, vehicleA } = await setup()
    const provB = await request(app)
      .post('/api/v1/service-providers')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ name: 'Bob Garage' })
    expect(provB.status).toBe(201)

    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/maintenance-records`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ category: 'oil_change', record_date: '2026-01-01', total_cost: 100 })
    expect(create.status).toBe(201)

    const patch = await request(app)
      .patch(`/api/v1/maintenance-records/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ service_provider_id: provB.body.id })
    expect(patch.status).toBe(404)
  })

  it('allows reassigning to a vehicle the caller owns', async () => {
    const { app, a, vehicleA } = await setup()
    const vehicleA2 = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${a.token}`)
      .send(baseVehicle)
    expect(vehicleA2.status).toBe(201)

    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/maintenance-records`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ category: 'oil_change', record_date: '2026-01-01', total_cost: 100 })
    expect(create.status).toBe(201)

    const patch = await request(app)
      .patch(`/api/v1/maintenance-records/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ vehicle_id: vehicleA2.body.id })
    expect(patch.status).toBe(200)
    expect(patch.body.vehicle_id).toBe(vehicleA2.body.id)
  })
})

describe('maintenance POST cannot attach another user’s service provider', () => {
  it('rejects service_provider_id owned by another user with 404', async () => {
    const { app, a, b, vehicleA } = await setup()
    const provB = await request(app)
      .post('/api/v1/service-providers')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ name: 'Bob Garage' })
    expect(provB.status).toBe(201)

    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/maintenance-records`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        category: 'oil_change',
        record_date: '2026-01-01',
        total_cost: 100,
        service_provider_id: provB.body.id,
      })
    expect(create.status).toBe(404)
  })
})

describe('fuel PATCH cannot reassign to another user’s vehicle', () => {
  it('rejects vehicle_id owned by another user with 404', async () => {
    const { app, a, b, vehicleA, vehicleB } = await setup()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/fuel-fillups`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ fillup_date: '2026-04-01', odometer_km: 11_000, liters: 40, total_cost: 240, full_tank: true })
    expect(create.status).toBe(201)

    const patch = await request(app)
      .patch(`/api/v1/fuel-fillups/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ vehicle_id: vehicleB })
    expect(patch.status).toBe(404)

    const after = await request(app)
      .get(`/api/v1/fuel-fillups/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
    expect(after.body.vehicle_id).toBe(vehicleA)
  })
})

describe('insurance PATCH cannot reassign to another user’s vehicle', () => {
  it('rejects vehicle_id owned by another user with 404', async () => {
    const { app, a, b, vehicleA, vehicleB } = await setup()
    const create = await request(app)
      .post(`/api/v1/vehicles/${vehicleA}/insurance-policies`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ insurer: 'Acme', start_date: '2026-01-01', expiry_date: '2027-01-01' })
    expect(create.status).toBe(201)

    const patch = await request(app)
      .patch(`/api/v1/insurance-policies/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({ vehicle_id: vehicleB })
    expect(patch.status).toBe(404)

    const after = await request(app)
      .get(`/api/v1/insurance-policies/${create.body.id}`)
      .set('Authorization', `Bearer ${a.token}`)
    expect(after.body.vehicle_id).toBe(vehicleA)
  })
})
