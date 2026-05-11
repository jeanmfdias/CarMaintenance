import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('fuel fillups', () => {
  it('creates a fillup, computes price_per_liter, and bumps vehicle odometer', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'fuel@example.com')

    const v = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        make: 'Honda',
        model: 'Civic',
        manufacture_year: 2019,
        model_year: 2019,
        fuel_type: 'gasoline',
        current_odometer: 50000,
      })
    expect(v.status).toBe(201)
    const vehicleId = v.body.id

    const f = await request(app)
      .post(`/api/v1/vehicles/${vehicleId}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fillup_date: '2026-04-01',
        odometer_km: 51000,
        liters: 40,
        total_cost: 240,
        fuel_type: 'gasoline',
        full_tank: true,
        notes: null,
      })
    expect(f.status).toBe(201)
    expect(f.body.price_per_liter).toBeCloseTo(6, 4)
    expect(f.body.full_tank).toBe(true)

    const list = await request(app)
      .get(`/api/v1/vehicles/${vehicleId}/fuel-fillups`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)
    expect(list.body[0].price_per_liter).toBeCloseTo(6, 4)

    // vehicle.current_odometer should have been synced upward
    const vAfter = await request(app)
      .get(`/api/v1/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(vAfter.body.current_odometer).toBe(51000)

    // a mirror odometer entry should exist
    const odo = await request(app)
      .get(`/api/v1/vehicles/${vehicleId}/odometer-entries`)
      .set('Authorization', `Bearer ${token}`)
    expect(odo.status).toBe(200)
    expect(odo.body.length).toBeGreaterThanOrEqual(1)
  })
})
