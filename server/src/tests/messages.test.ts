import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { initDb } from '../db.js'
import { createMessagesRouter } from '../routes/messages.js'
import type Database from 'better-sqlite3'

const mockScheduler = {
  add: vi.fn(),
  cancel: vi.fn(),
  hydrate: vi.fn(),
}

let db: Database.Database
let app: express.Application

beforeEach(() => {
  db = initDb(':memory:')
  db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '15551234567', 'individual')`).run()
  app = express()
  app.use(express.json())
  app.use('/api/messages', createMessagesRouter(db, mockScheduler))
  vi.clearAllMocks()
})

describe('GET /api/messages', () => {
  it('returns empty array when no messages', async () => {
    const res = await request(app).get('/api/messages')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns messages sorted by scheduled_at asc', async () => {
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at) VALUES ('m1','c1','text','first',?,  'pending',?)`).run(now + 200, now)
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at) VALUES ('m2','c1','text','second',?,'pending',?)`).run(now + 100, now)
    const res = await request(app).get('/api/messages')
    expect(res.status).toBe(200)
    expect(res.body[0].id).toBe('m2')
    expect(res.body[1].id).toBe('m1')
  })
})

describe('POST /api/messages', () => {
  it('creates a message and calls scheduler.add', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 3600
    const res = await request(app).post('/api/messages').send({
      recipient_id: 'c1',
      content_type: 'text',
      text: 'Hello!',
      scheduled_at: futureTs,
    })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(mockScheduler.add).toHaveBeenCalledWith(res.body.id, futureTs)
  })

  it('returns 400 when scheduled_at is in the past', async () => {
    const pastTs = Math.floor(Date.now() / 1000) - 60
    const res = await request(app).post('/api/messages').send({
      recipient_id: 'c1',
      content_type: 'text',
      text: 'Late!',
      scheduled_at: pastTs,
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when recipient_id does not exist', async () => {
    const res = await request(app).post('/api/messages').send({
      recipient_id: 'nonexistent',
      content_type: 'text',
      text: 'x',
      scheduled_at: Math.floor(Date.now() / 1000) + 60,
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/messages/:id', () => {
  it('deletes message and calls scheduler.cancel', async () => {
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at) VALUES ('m1','c1','text','x',?,  'pending',?)`).run(now + 100, now)
    const res = await request(app).delete('/api/messages/m1')
    expect(res.status).toBe(204)
    expect(mockScheduler.cancel).toHaveBeenCalledWith('m1')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/messages/nope')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/messages/:id/retry', () => {
  it('re-schedules a failed message', async () => {
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, error, created_at) VALUES ('m1','c1','text','x',?,'failed','oops',?)`).run(now - 100, now)
    const newTs = now + 3600
    const res = await request(app).post('/api/messages/m1/retry').send({ scheduled_at: newTs })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending')
    expect(mockScheduler.add).toHaveBeenCalledWith('m1', newTs)
  })

  it('returns 400 when retrying a message that is not failed', async () => {
    const now = Math.floor(Date.now() / 1000)
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at) VALUES ('m1','c1','text','x',?,'sent',?)`).run(now - 100, now)
    const res = await request(app).post('/api/messages/m1/retry').send({ scheduled_at: now + 3600 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when message does not exist', async () => {
    const now = Math.floor(Date.now() / 1000)
    const res = await request(app).post('/api/messages/nonexistent/retry').send({ scheduled_at: now + 3600 })
    expect(res.status).toBe(404)
  })
})
