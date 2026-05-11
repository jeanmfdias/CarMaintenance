import './setup.js'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { makeApp, signInAs } from './helpers.js'

describe('settings upsert', () => {
  it('GET creates defaults; PUT updates; subsequent GET returns updated', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'settings@example.com')

    const g1 = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
    expect(g1.status).toBe(200)
    expect(g1.body.locale).toBe('en')
    expect(g1.body.default_reminder_lead_days).toBe(30)

    const p = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'pt-BR', default_reminder_lead_days: 14 })
    expect(p.status).toBe(200)
    expect(p.body.locale).toBe('pt-BR')
    expect(p.body.default_reminder_lead_days).toBe(14)

    const g2 = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
    expect(g2.body.locale).toBe('pt-BR')
    expect(g2.body.default_reminder_lead_days).toBe(14)
  })

  it('rejects invalid locale', async () => {
    const app = makeApp()
    const { token } = await signInAs(app, 'settings2@example.com')
    const r = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'fr-FR' })
    expect(r.status).toBe(400)
  })
})
