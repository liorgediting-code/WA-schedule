import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { createWhatsAppClient } from '../whatsapp.js'

type ClientFactory = () => ReturnType<typeof createWhatsAppClient>

export function createContactsRouter(db: Database.Database, getClient: ClientFactory): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    const contacts = db.prepare(`SELECT * FROM contacts ORDER BY is_favorite DESC, name ASC`).all()
    res.json(contacts)
  })

  router.post('/', (req, res) => {
    const { name, wa_id, type } = req.body as { name: string; wa_id: string; type: string }
    if (!name || !wa_id || !type) {
      res.status(400).json({ error: 'name, wa_id, and type are required' })
      return
    }
    const id = uuidv4()
    try {
      db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES (?, ?, ?, ?)`).run(id, name, wa_id, type)
    } catch {
      res.status(400).json({ error: 'wa_id already exists' })
      return
    }
    const contact = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id)
    res.status(201).json(contact)
  })

  router.post('/verify', async (_req, res) => {
    const token = (db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_access_token'`).get() as { value: string } | undefined)?.value
    const phoneId = (db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_phone_number_id'`).get() as { value: string } | undefined)?.value
    if (!token || !phoneId) {
      res.json({ ok: false, error: 'Credentials not configured' })
      return
    }
    try {
      const ok = await getClient().verifyCredentials()
      res.json({ ok })
    } catch {
      res.json({ ok: false, error: 'Verification failed' })
    }
  })

  router.put('/:id', (req, res) => {
    const { id } = req.params
    const { name, is_favorite } = req.body as { name?: string; is_favorite?: number }
    const contact = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id)
    if (!contact) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    if (name !== undefined) db.prepare(`UPDATE contacts SET name = ? WHERE id = ?`).run(name, id)
    if (is_favorite !== undefined) db.prepare(`UPDATE contacts SET is_favorite = ? WHERE id = ?`).run(is_favorite, id)
    res.json(db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id))
  })

  router.delete('/:id', (req, res) => {
    const { id } = req.params
    const contact = db.prepare(`SELECT id FROM contacts WHERE id = ?`).get(id)
    if (!contact) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id)
    res.status(204).send()
  })

  return router
}
