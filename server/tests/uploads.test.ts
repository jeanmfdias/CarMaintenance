import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

const tinyPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63600100000005000162cf' +
    'a5e1010000000049454e44ae426082',
  'hex'
)

async function createVehicle(app: ReturnType<typeof makeApp>, token: string) {
  const v = await request(app)
    .post('/api/v1/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send({
      make: 'X', model: 'Y',
      manufacture_year: 2020, model_year: 2020,
      fuel_type: 'gasoline', current_odometer: 0,
    })
  expect(v.status).toBe(201)
  return v.body.id as string
}

describe('photo upload edge cases', () => {
  it('rejects wrong MIME type (text/plain) with 400', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'up1@example.com')
    const id = await createVehicle(app, token)

    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })
    expect(r.status).toBe(400)
  })

  it('rejects an unknown form field name with 400', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'up2@example.com')
    const id = await createVehicle(app, token)

    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('image', tinyPng, { filename: 'a.png', contentType: 'image/png' })
    // Multer sees an unexpected field "image" (we expect "file") -> LIMIT_UNEXPECTED_FILE -> 400.
    expect(r.status).toBe(400)
  })

  it('rejects oversized uploads with 413', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'up3@example.com')
    const id = await createVehicle(app, token)

    // 10 MB > 8 MB cap
    const big = Buffer.alloc(10 * 1024 * 1024, 0)
    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
    expect(r.status).toBe(413)
  })

  it('rejects content-type spoofing (body declared image/png but bytes are text)', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'up-spoof@example.com')
    const id = await createVehicle(app, token)

    // Multer's fileFilter will accept the declared image/png header, but the
    // sniff in the handler must catch that the bytes aren't an image.
    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('totally-not-a-png-but-i-said-it-was'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
    expect(r.status).toBe(400)
    expect(r.body.error.message).toMatch(/not a recognized/i)
  })

  it('rejects unauthenticated GET /uploads/<id>/<file>', async () => {
    const app = makeApp()
    const r = await request(app).get('/uploads/some-user/some-file.png')
    expect(r.status).toBe(401)
  })

  it('accepts a valid PNG and stores under /uploads/<userId>/<vehicleId>.png', async () => {
    const app = makeApp()
    const { token, userId } = await signInAs(app, 'up4@example.com')
    const id = await createVehicle(app, token)

    const r = await request(app)
      .post(`/api/v1/vehicles/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', tinyPng, { filename: 'pwn.exe', contentType: 'image/png' })
    expect(r.status).toBe(201)
    // Extension always comes from the MIME, never from the client filename.
    expect(r.body.photo_url).toBe(`/uploads/${userId}/${id}.png`)
  })
})
