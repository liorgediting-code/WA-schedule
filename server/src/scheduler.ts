import schedule from 'node-schedule'
import type Database from 'better-sqlite3'

interface ScheduledMessage {
  id: string
  recipient_id: string
  content_type: 'text' | 'image' | 'video' | 'document'
  text: string | null
  media_id: string | null
  scheduled_at: number
  wa_id: string
}

type SendFn = (msg: ScheduledMessage) => Promise<void>

interface Scheduler {
  hydrate(): void
  add(msgId: string, scheduledAt: number): void
  cancel(msgId: string): void
}

export function createScheduler(db: Database.Database, send: SendFn): Scheduler {
  const jobs = new Map<string, schedule.Job>()

  function markFailed(id: string, error: string) {
    db.prepare(`UPDATE scheduled_messages SET status = 'failed', error = ? WHERE id = ?`).run(error, id)
  }

  function markSent(id: string) {
    db.prepare(`UPDATE scheduled_messages SET status = 'sent' WHERE id = ?`).run(id)
  }

  function scheduleOne(msg: ScheduledMessage) {
    const fireAt = new Date(msg.scheduled_at * 1000)
    const job = schedule.scheduleJob(msg.id, fireAt, async () => {
      try {
        await send(msg)
        markSent(msg.id)
      } catch (err) {
        markFailed(msg.id, err instanceof Error ? err.message : String(err))
      } finally {
        jobs.delete(msg.id)
      }
    })
    if (job) jobs.set(msg.id, job)
  }

  return {
    hydrate() {
      const now = Math.floor(Date.now() / 1000)
      const pending = db.prepare(`
        SELECT m.*, c.wa_id
        FROM scheduled_messages m
        JOIN contacts c ON c.id = m.recipient_id
        WHERE m.status = 'pending'
      `).all() as (ScheduledMessage & { scheduled_at: number })[]

      for (const msg of pending) {
        if (msg.scheduled_at <= now) {
          markFailed(msg.id, 'missed — app was offline')
        } else {
          scheduleOne(msg)
        }
      }
    },

    add(msgId, scheduledAt) {
      const msg = db.prepare(`
        SELECT m.*, c.wa_id
        FROM scheduled_messages m
        JOIN contacts c ON c.id = m.recipient_id
        WHERE m.id = ?
      `).get(msgId) as ScheduledMessage | undefined
      if (!msg) throw new Error(`Message ${msgId} not found`)
      scheduleOne({ ...msg, scheduled_at: scheduledAt })
    },

    cancel(msgId) {
      const job = jobs.get(msgId)
      if (job) {
        job.cancel()
        jobs.delete(msgId)
      }
    },
  }
}
