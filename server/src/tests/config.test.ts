import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { initDb } from '../db.js'
import { createConfigRouter } from '../routes/config.js'
import type Database from 'better-sqlite3'

let db: Database.Database
let app: express.Application

beforeEach(() => {
  db = initDb(':memory:')
  app = express()
  app.use(express.json())
  app.use('/api/config', createConfigRouter(db))
})

describe('GET /api/config', () => {
  it('returns empty object when no config set', async () => {
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({})
  })

  it('returns config as key-value object (token redacted)', async () => {
    db.prepare(`INSERT INTO config (key, value) VALUES ('whatsapp_access_token', 'secret'), ('timezone', 'UTC')`).run()
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body.timezone).toBe('UTC')
    expect(res.body.whatsapp_access_token).toBe('***')
  })
})

describe('PUT /api/config', () => {
  it('upserts config keys', async () => {
    const res = await request(app).put('/api/config').send({
      whatsapp_phone_number_id: 'ph123',
      timezone: 'America/New_York',
    })
    expect(res.status).toBe(200)
    const row = db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_phone_number_id'`).get() as { value: string }
    expect(row.value).toBe('ph123')
  })
})
