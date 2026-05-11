import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../src/app.js'

export function makeApp(): Express {
  return createApp()
}

export async function signInAs(app: Express, email: string): Promise<{ token: string; userId: string }> {
  const r1 = await request(app).post('/api/v1/auth/magic-link').send({ email })
  if (r1.status !== 200) throw new Error(`magic-link failed: ${r1.status} ${r1.text}`)

  // Grab the latest token for the user from the DB
  const { getDb } = await import('../src/db/index.js')
  const row = getDb()
    .prepare(
      `SELECT token, user_id FROM magic_link_tokens WHERE email = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(email.toLowerCase()) as { token: string; user_id: string } | undefined
  if (!row) throw new Error('token not found in DB')

  const r2 = await request(app).post('/api/v1/auth/verify').send({ token: row.token })
  if (r2.status !== 200) throw new Error(`verify failed: ${r2.status} ${r2.text}`)
  return { token: r2.body.access_token as string, userId: row.user_id }
}
