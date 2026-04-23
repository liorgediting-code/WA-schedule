import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import type { createScheduler } from '../scheduler.js'

type Scheduler = ReturnType<typeof createScheduler>

export function createMessagesRouter(db: Database.Database, scheduler: Scheduler): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const messages = db.prepare(`
      SELECT m.*, c.name AS recipient_name, c.wa_id
      FROM scheduled_messages m
      JOIN contacts c ON c.id = m.recipient_id
      ORDER BY m.scheduled_at ASC
    `).all()
    res.json(messages)
  })

  router.post('/', (req, res) => {
    const { recipient_id, content_type, text, media_id, scheduled_at } = req.body as {
      recipient_id: string
      content_type: string
      text?: string
      media_id?: string
      scheduled_at: number
    }

    const now = Math.floor(Date.now() / 1000)
    if (!scheduled_at || scheduled_at <= now) {
      res.status(400).json({ error: 'scheduled_at must be in the future' })
      return
    }

    const contact = db.prepare(`SELECT id FROM contacts WHERE id = ?`).get(recipient_id)
    if (!contact) {
      res.status(400).json({ error: 'recipient_id not found' })
      return
    }

    const id = uuidv4()
    db.prepare(`
      INSERT INTO scheduled_messages (id, recipient_id, content_type, text, media_id, scheduled_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, recipient_id, content_type, text ?? null, media_id ?? null, scheduled_at, now)

    scheduler.add(id, scheduled_at)

    const msg = db.prepare(`SELECT * FROM scheduled_messages WHERE id = ?`).get(id)
    res.status(201).json(msg)
  })

  router.delete('/:id', (req, res) => {
    const { id } = req.params
    const msg = db.prepare(`SELECT id FROM scheduled_messages WHERE id = ?`).get(id)
    if (!msg) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    scheduler.cancel(id)
    db.prepare(`DELETE FROM scheduled_messages WHERE id = ?`).run(id)
    res.status(204).send()
  })

  router.post('/:id/retry', (req, res) => {
    const { id } = req.params
    const { scheduled_at } = req.body as { scheduled_at: number }

    const msg = db.prepare(`SELECT * FROM scheduled_messages WHERE id = ?`).get(id) as
      | { status: string }
      | undefined

    if (!msg) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (msg.status !== 'failed') {
      res.status(400).json({ error: 'Only failed messages can be retried' })
      return
    }

    const now = Math.floor(Date.now() / 1000)
    if (!scheduled_at || scheduled_at <= now) {
      res.status(400).json({ error: 'scheduled_at must be in the future' })
      return
    }

    db.prepare(`
      UPDATE scheduled_messages SET status = 'pending', error = NULL, scheduled_at = ? WHERE id = ?
    `).run(scheduled_at, id)

    scheduler.add(id, scheduled_at)

    const updated = db.prepare(`SELECT * FROM scheduled_messages WHERE id = ?`).get(id)
    res.json(updated)
  })

  return router
}
