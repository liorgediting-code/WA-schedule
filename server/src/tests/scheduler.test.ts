import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initDb } from '../db.js'
import { createScheduler } from '../scheduler.js'
import type Database from 'better-sqlite3'

vi.mock('node-schedule', () => ({
  default: {
    scheduleJob: vi.fn(() => ({ cancel: vi.fn() })),
  },
}))

let db: Database.Database

beforeEach(() => {
  db = initDb(':memory:')
  db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '15551234567', 'individual')`).run()
})

describe('hydrate', () => {
  it('marks past-due pending messages as failed on startup', () => {
    const pastTime = Math.floor(Date.now() / 1000) - 3600
    db.prepare(`
      INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at)
      VALUES ('m1', 'c1', 'text', 'hello', ?, 'pending', ?)
    `).run(pastTime, pastTime)

    const sendFn = vi.fn()
    const scheduler = createScheduler(db, sendFn)
    scheduler.hydrate()

    const msg = db.prepare(`SELECT * FROM scheduled_messages WHERE id = 'm1'`).get() as { status: string; error: string }
    expect(msg.status).toBe('failed')
    expect(msg.error).toBe('missed — app was offline')
  })

  it('schedules future pending messages', async () => {
    const schedule = (await import('node-schedule')).default
    const futureTime = Math.floor(Date.now() / 1000) + 3600
    db.prepare(`
      INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at)
      VALUES ('m2', 'c1', 'text', 'future', ?, 'pending', ?)
    `).run(futureTime, futureTime)

    const sendFn = vi.fn()
    const scheduler = createScheduler(db, sendFn)
    scheduler.hydrate()

    expect(schedule.scheduleJob).toHaveBeenCalled()
  })
})
