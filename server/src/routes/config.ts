import { Router } from 'express'
import type Database from 'better-sqlite3'

const ALLOWED_KEYS = ['whatsapp_phone_number_id', 'whatsapp_access_token', 'timezone'] as const
const REDACTED_KEYS = new Set(['whatsapp_access_token'])

export function createConfigRouter(db: Database.Database): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const rows = db.prepare(`SELECT key, value FROM config`).all() as { key: string; value: string }[]
    const result: Record<string, string> = {}
    for (const { key, value } of rows) {
      result[key] = REDACTED_KEYS.has(key) ? '***' : value
    }
    res.json(result)
  })

  router.put('/', (req, res) => {
    const body = req.body as Record<string, string>
    const upsert = db.prepare(`INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    const upsertMany = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) upsert.run(key, value)
    })
    const entries = Object.entries(body).filter(([k]) => (ALLOWED_KEYS as readonly string[]).includes(k)) as [string, string][]
    upsertMany(entries)
    res.json({ ok: true })
  })

  return router
}
