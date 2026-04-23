import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDb, getDb } from '../db.js'
import Database from 'better-sqlite3'

let db: Database.Database

beforeEach(() => {
  db = initDb(':memory:')
})

afterEach(() => {
  db.close()
})

describe('db schema', () => {
  it('creates scheduled_messages table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_messages'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates contacts table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates config table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='config'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('enforces content_type CHECK constraint', () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    expect(() =>
      db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, scheduled_at, status, created_at) VALUES ('m1', 'c1', 'invalid', 1000, 'pending', 1000)`).run()
    ).toThrow()
  })

  it('enforces wa_id UNIQUE constraint', () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    expect(() =>
      db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c2', 'Bob', '111', 'individual')`).run()
    ).toThrow()
  })

  it('cascades delete from contacts to scheduled_messages', () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    db.prepare(`INSERT INTO scheduled_messages (id, recipient_id, content_type, text, scheduled_at, status, created_at) VALUES ('m1', 'c1', 'text', 'hi', 1000, 'pending', 1000)`).run()
    db.prepare(`DELETE FROM contacts WHERE id = 'c1'`).run()
    const msg = db.prepare(`SELECT * FROM scheduled_messages WHERE id = 'm1'`).get()
    expect(msg).toBeUndefined()
  })
})

describe('getDb', () => {
  it('returns the same instance after initDb', () => {
    expect(getDb()).toBe(db)
  })
})
