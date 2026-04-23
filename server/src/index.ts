import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './db.js'
import { createScheduler } from './scheduler.js'
import { createWhatsAppClient } from './whatsapp.js'
import { createMessagesRouter } from './routes/messages.js'
import { createContactsRouter } from './routes/contacts.js'
import { createConfigRouter } from './routes/config.js'
import { createUploadRouter } from './routes/upload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

const db = initDb(path.join(__dirname, '../../data/scheduler.db'))

function getClient() {
  const token = (db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_access_token'`).get() as { value: string } | undefined)?.value ?? ''
  const phoneId = (db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_phone_number_id'`).get() as { value: string } | undefined)?.value ?? ''
  return createWhatsAppClient({ accessToken: token, phoneNumberId: phoneId })
}

async function sendMessage(msg: {
  id: string; wa_id: string; content_type: string; text: string | null; media_id: string | null
}) {
  const client = getClient()
  if (msg.content_type === 'text') {
    await client.sendText(msg.wa_id, msg.text!)
  } else {
    await client.sendMedia(msg.wa_id, msg.media_id!, msg.content_type as 'image' | 'video' | 'document', msg.text ?? undefined)
  }
}

const scheduler = createScheduler(db, sendMessage)
scheduler.hydrate()

const app = express()
app.use(express.json())

app.use('/api/messages', createMessagesRouter(db, scheduler))
app.use('/api/contacts', createContactsRouter(db, getClient))
app.use('/api/config', createConfigRouter(db))
app.use('/api/upload', createUploadRouter(db, getClient))

const publicDir = path.join(__dirname, '../../public')
app.use(express.static(publicDir))
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')))

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
