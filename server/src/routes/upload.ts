import { Router } from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import type Database from 'better-sqlite3'
import { createWhatsAppClient } from '../whatsapp.js'

type ClientFactory = () => ReturnType<typeof createWhatsAppClient>

const upload = multer({ dest: '/tmp/wa-uploads/' })

export function createUploadRouter(db: Database.Database, getClient: ClientFactory): Router {
  const router = Router()

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const { path, mimetype, originalname } = req.file

    try {
      const buffer = await fs.readFile(path)
      const mediaId = await getClient().uploadMedia(buffer, mimetype, originalname)
      await fs.unlink(path).catch(() => {})
      res.json({ media_id: mediaId })
    } catch (err) {
      await fs.unlink(path).catch(() => {})
      res.status(502).json({ error: err instanceof Error ? err.message : 'Upload failed' })
    }
  })

  return router
}
