import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { initDb } from '../db.js'
import { createContactsRouter } from '../routes/contacts.js'
import type Database from 'better-sqlite3'

const mockWaClient = {
  verifyCredentials: vi.fn(),
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  uploadMedia: vi.fn(),
}

let db: Database.Database
let app: express.Application

beforeEach(() => {
  db = initDb(':memory:')
  app = express()
  app.use(express.json())
  app.use('/api/contacts', createContactsRouter(db, () => mockWaClient))
  vi.clearAllMocks()
})

describe('GET /api/contacts', () => {
  it('returns all contacts', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).get('/api/contacts')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Alice')
  })
})

describe('POST /api/contacts', () => {
  it('creates a contact', async () => {
    const res = await request(app).post('/api/contacts').send({
      name: 'Bob', wa_id: '222', type: 'individual',
    })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Bob')
  })

  it('returns 400 when wa_id is duplicate', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).post('/api/contacts').send({
      name: 'Dup', wa_id: '111', type: 'individual',
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/contacts/:id', () => {
  it('updates name and is_favorite', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).put('/api/contacts/c1').send({ name: 'Alicia', is_favorite: 1 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Alicia')
    expect(res.body.is_favorite).toBe(1)
  })
})

describe('DELETE /api/contacts/:id', () => {
  it('deletes contact', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).delete('/api/contacts/c1')
    expect(res.status).toBe(204)
  })
})

describe('POST /api/contacts/verify', () => {
  it('returns ok:true when credentials are valid', async () => {
    mockWaClient.verifyCredentials.mockResolvedValueOnce(true)
    db.prepare(`INSERT INTO config (key, value) VALUES ('whatsapp_access_token', 'tok'), ('whatsapp_phone_number_id', 'ph')`).run()
    const res = await request(app).post('/api/contacts/verify')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns ok:false when credentials missing', async () => {
    const res = await request(app).post('/api/contacts/verify')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
  })
})
