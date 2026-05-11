import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

const newVehicle = {
  make: 'Toyota',
  model: 'Corolla',
  manufacture_year: 2020,
  model_year: 2021,
  purchase_date: '2022-01-01',
  sell_date: null,
  fuel_type: 'flex',
  photo_url: null,
  current_odometer: 12345,
  notes: null,
}

describe('vehicles CRUD + ownership isolation', () => {
  it('creates, lists, fetches, patches, deletes a vehicle', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'alice@example.com')

    const create = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send(newVehicle)
    expect(create.status).toBe(201)
    expect(create.body.id).toBeTruthy()
    expect(create.body.make).toBe('Toyota')

    const list = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body).toHaveLength(1)

    const id = create.body.id as string
    const fetchOne = await request(app)
      .get(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(fetchOne.status).toBe(200)
    expect(fetchOne.body.id).toBe(id)

    const patch = await request(app)
      .patch(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'hello' })
    expect(patch.status).toBe(200)
    expect(patch.body.notes).toBe('hello')

    const del = await request(app)
      .delete(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(204)
  })

  it("returns 404 when fetching another user's vehicle", async () => {
    const app = makeApp()
    const a = await signInAs(app, 'a@example.com')
    const b = await signInAs(app, 'b@example.com')

    const create = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${a.token}`)
      .send(newVehicle)
    expect(create.status).toBe(201)
    const id = create.body.id

    const cross = await request(app)
      .get(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
    expect(cross.status).toBe(404)

    const crossPatch = await request(app)
      .patch(`/api/v1/vehicles/${id}`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ notes: 'pwn' })
    expect(crossPatch.status).toBe(404)

    const bList = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${b.token}`)
    expect(bList.body).toHaveLength(0)
  })

  it('rejects invalid bodies with 400', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'c@example.com')
    const r = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ make: '' }) // missing required fields
    expect(r.status).toBe(400)
    expect(r.body.error.code).toBe('validation_error')
  })
})
