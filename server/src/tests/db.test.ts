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
})

describe('getDb', () => {
  it('returns the same instance after initDb', () => {
    expect(getDb()).toBe(db)
  })
})
