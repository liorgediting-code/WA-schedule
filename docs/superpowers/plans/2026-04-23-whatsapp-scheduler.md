# WhatsApp Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted web app that schedules WhatsApp Business Cloud API messages (text + media) to contacts and groups, with a React queue/compose/contacts/settings UI.

**Architecture:** React (Vite) SPA + Express backend in a single repo. Express handles the REST API, serves the compiled SPA, and runs an in-process `node-schedule` job scheduler. SQLite (via `better-sqlite3`) stores all state. Single Docker image for self-hosting.

**Tech Stack:** Node 20, TypeScript, Express 4, better-sqlite3, node-schedule, multer, uuid, React 18, Vite 5, React Router v6, vitest, supertest, Docker

---

## File Map

```
.
├── package.json              # root: npm workspaces + concurrently dev runner
├── .gitignore
├── Dockerfile
├── .dockerignore
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts        # proxy /api → :3001 in dev
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx           # sidebar layout + React Router
│       ├── types.ts          # ScheduledMessage, Contact, ConfigMap
│       ├── api.ts            # typed fetch wrappers for every endpoint
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   └── StatusBadge.tsx
│       └── pages/
│           ├── QueuePage.tsx
│           ├── ComposePage.tsx
│           ├── ContactsPage.tsx
│           └── SettingsPage.tsx
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts          # Express app + startup
        ├── db.ts             # SQLite schema, migrations, typed query helpers
        ├── scheduler.ts      # node-schedule wrapper: hydrate, add, cancel
        ├── whatsapp.ts       # Meta Graph API client
        └── routes/
            ├── messages.ts   # GET/POST/DELETE /api/messages, POST /api/messages/:id/retry
            ├── contacts.ts   # GET/POST/PUT/DELETE /api/contacts, POST /api/contacts/verify
            ├── config.ts     # GET/PUT /api/config
            └── upload.ts     # POST /api/upload
        └── tests/
            ├── db.test.ts
            ├── whatsapp.test.ts
            ├── messages.test.ts
            ├── contacts.test.ts
            ├── config.test.ts
            └── upload.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "whatsapp-scheduler",
  "private": true,
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=client\"",
    "build": "npm run build --workspace=client && npm run build --workspace=server",
    "test": "npm run test --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
server/data/
*.db
.env
.superpowers/
```

- [ ] **Step 3: Create `server/package.json`**

```json
{
  "name": "whatsapp-scheduler-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "express": "^4.18.3",
    "multer": "^1.4.5-lts.1",
    "node-schedule": "^2.1.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.11.5",
    "@types/node-schedule": "^2.1.7",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^9.0.7",
    "supertest": "^6.3.4",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.3.1"
  }
}
```

- [ ] **Step 4: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `client/package.json`**

```json
{
  "name": "whatsapp-scheduler-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 6: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Create `client/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 8: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Scheduler</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Install all dependencies**

```bash
npm install
```

Expected: `node_modules/` populated in root, `client/`, and `server/`. No errors.

- [ ] **Step 10: Commit**

```bash
git add package.json .gitignore client/package.json client/tsconfig.json client/vite.config.ts client/index.html server/package.json server/tsconfig.json
git commit -m "feat: project scaffold with npm workspaces"
```

---

## Task 2: Database Layer

**Files:**
- Create: `server/src/db.ts`
- Create: `server/src/tests/db.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/db.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test
```

Expected: FAIL — `Cannot find module '../db.js'`

- [ ] **Step 3: Implement `server/src/db.ts`**

```typescript
import Database from 'better-sqlite3'

let instance: Database.Database | null = null

export function initDb(path: string = './data/scheduler.db'): Database.Database {
  instance = new Database(path)
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')

  instance.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wa_id TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('individual', 'group')),
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'video', 'document')),
      text TEXT,
      media_id TEXT,
      scheduled_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
      error TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  return instance
}

export function getDb(): Database.Database {
  if (!instance) throw new Error('DB not initialized — call initDb() first')
  return instance
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npm test
```

Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts server/src/tests/db.test.ts
git commit -m "feat: SQLite schema and db init"
```

---

## Task 3: WhatsApp API Client

**Files:**
- Create: `server/src/whatsapp.ts`
- Create: `server/src/tests/whatsapp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/whatsapp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { createWhatsAppClient } from '../whatsapp.js'

const creds = { phoneNumberId: 'ph123', accessToken: 'tok456' }

beforeEach(() => {
  mockFetch.mockReset()
})

describe('verifyCredentials', () => {
  it('returns true when API responds 200', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ph123' }) })
    const client = createWhatsAppClient(creds)
    expect(await client.verifyCredentials()).toBe(true)
  })

  it('returns false when API responds 401', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
    const client = createWhatsAppClient(creds)
    expect(await client.verifyCredentials()).toBe(false)
  })
})

describe('sendText', () => {
  it('calls the correct endpoint with correct body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) })
    const client = createWhatsAppClient(creds)
    await client.sendText('15551234567', 'Hello!')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v18.0/ph123/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok456' }),
      })
    )
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.to).toBe('15551234567')
    expect(body.text.body).toBe('Hello!')
  })

  it('throws when API returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'bad' } }) })
    const client = createWhatsAppClient(creds)
    await expect(client.sendText('123', 'hi')).rejects.toThrow('bad')
  })
})

describe('sendMedia', () => {
  it('sends correct body for image type', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'wamid.2' }] }) })
    const client = createWhatsAppClient(creds)
    await client.sendMedia('15551234567', 'mediaid123', 'image', 'A caption')
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.type).toBe('image')
    expect(body.image.id).toBe('mediaid123')
    expect(body.image.caption).toBe('A caption')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test
```

Expected: FAIL — `Cannot find module '../whatsapp.js'`

- [ ] **Step 3: Implement `server/src/whatsapp.ts`**

```typescript
const BASE = 'https://graph.facebook.com/v18.0'

interface Creds {
  phoneNumberId: string
  accessToken: string
}

interface WhatsAppClient {
  verifyCredentials(): Promise<boolean>
  sendText(to: string, text: string): Promise<void>
  sendMedia(to: string, mediaId: string, type: 'image' | 'video' | 'document', caption?: string): Promise<void>
  uploadMedia(fileBuffer: Buffer, mimeType: string, filename: string): Promise<string>
}

export function createWhatsAppClient({ phoneNumberId, accessToken }: Creds): WhatsAppClient {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${BASE}/${phoneNumberId}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const json = await res.json() as Record<string, unknown>
    if (!res.ok) {
      const msg = (json.error as { message?: string })?.message ?? `HTTP ${res.status}`
      throw new Error(msg)
    }
    return json
  }

  return {
    async verifyCredentials() {
      const res = await fetch(`${BASE}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return res.ok
    },

    async sendText(to, text) {
      await post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      })
    },

    async sendMedia(to, mediaId, type, caption) {
      await post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type,
        [type]: { id: mediaId, ...(caption ? { caption } : {}) },
      })
    },

    async uploadMedia(fileBuffer, mimeType, filename) {
      const form = new FormData()
      form.append('messaging_product', 'whatsapp')
      form.append('type', mimeType)
      form.append('file', new Blob([fileBuffer], { type: mimeType }), filename)

      const res = await fetch(`${BASE}/${phoneNumberId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      })
      const json = await res.json() as { id?: string; error?: { message: string } }
      if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`)
      return json.id!
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npm test
```

Expected: all WhatsApp tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/whatsapp.ts server/src/tests/whatsapp.test.ts
git commit -m "feat: WhatsApp Business Cloud API client"
```

---

## Task 4: Scheduler

**Files:**
- Create: `server/src/scheduler.ts`
- Create: `server/src/tests/scheduler.test.ts` (partial — hydration logic)

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/scheduler.test.ts`:

```typescript
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

  it('schedules future pending messages', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test -- scheduler
```

Expected: FAIL — `Cannot find module '../scheduler.js'`

- [ ] **Step 3: Implement `server/src/scheduler.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npm test -- scheduler
```

Expected: all scheduler tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/scheduler.ts server/src/tests/scheduler.test.ts
git commit -m "feat: in-process job scheduler with startup hydration"
```

---

## Task 5: Messages Routes

**Files:**
- Create: `server/src/routes/messages.ts`
- Create: `server/src/tests/messages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/messages.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test -- messages
```

Expected: FAIL — `Cannot find module '../routes/messages.js'`

- [ ] **Step 3: Implement `server/src/routes/messages.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npm test -- messages
```

Expected: all messages tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/messages.ts server/src/tests/messages.test.ts
git commit -m "feat: messages CRUD routes with scheduler integration"
```

---

## Task 6: Contacts Routes

**Files:**
- Create: `server/src/routes/contacts.ts`
- Create: `server/src/tests/contacts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/tests/contacts.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { initDb } from '../db.js'
import { createContactsRouter } from '../routes/contacts.js'
import type Database from 'better-sqlite3'

const mockWaClient = {
  verifyCredentials: vi.fn(),
  sendText: vi.fn(),
  sendMedia: vi.fn(),
  uploadMedia: vi.fn(),
}

let db: Database.Database
let app: express.Application

beforeEach(() => {
  db = initDb(':memory:')
  app = express()
  app.use(express.json())
  app.use('/api/contacts', createContactsRouter(db, () => mockWaClient))
  vi.clearAllMocks()
})

describe('GET /api/contacts', () => {
  it('returns all contacts', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).get('/api/contacts')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Alice')
  })
})

describe('POST /api/contacts', () => {
  it('creates a contact', async () => {
    const res = await request(app).post('/api/contacts').send({
      name: 'Bob', wa_id: '222', type: 'individual',
    })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Bob')
  })

  it('returns 400 when wa_id is duplicate', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).post('/api/contacts').send({
      name: 'Dup', wa_id: '111', type: 'individual',
    })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/contacts/:id', () => {
  it('updates name and is_favorite', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).put('/api/contacts/c1').send({ name: 'Alicia', is_favorite: 1 })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Alicia')
    expect(res.body.is_favorite).toBe(1)
  })
})

describe('DELETE /api/contacts/:id', () => {
  it('deletes contact', async () => {
    db.prepare(`INSERT INTO contacts (id, name, wa_id, type) VALUES ('c1', 'Alice', '111', 'individual')`).run()
    const res = await request(app).delete('/api/contacts/c1')
    expect(res.status).toBe(204)
  })
})

describe('POST /api/contacts/verify', () => {
  it('returns ok:true when credentials are valid', async () => {
    mockWaClient.verifyCredentials.mockResolvedValueOnce(true)
    db.prepare(`INSERT INTO config (key, value) VALUES ('whatsapp_access_token', 'tok'), ('whatsapp_phone_number_id', 'ph')`).run()
    const res = await request(app).post('/api/contacts/verify')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns ok:false when credentials missing', async () => {
    const res = await request(app).post('/api/contacts/verify')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test -- contacts
```

Expected: FAIL — `Cannot find module '../routes/contacts.js'`

- [ ] **Step 3: Implement `server/src/routes/contacts.ts`**

```typescript
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

  return router
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npm test -- contacts
```

Expected: all contacts tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/contacts.ts server/src/tests/contacts.test.ts
git commit -m "feat: contacts CRUD routes"
```

---

## Task 7: Config + Upload Routes

**Files:**
- Create: `server/src/routes/config.ts`
- Create: `server/src/routes/upload.ts`
- Create: `server/src/tests/config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/src/tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { initDb } from '../db.js'
import { createConfigRouter } from '../routes/config.js'
import type Database from 'better-sqlite3'

let db: Database.Database
let app: express.Application

beforeEach(() => {
  db = initDb(':memory:')
  app = express()
  app.use(express.json())
  app.use('/api/config', createConfigRouter(db))
})

describe('GET /api/config', () => {
  it('returns empty object when no config set', async () => {
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({})
  })

  it('returns config as key-value object (token redacted)', async () => {
    db.prepare(`INSERT INTO config (key, value) VALUES ('whatsapp_access_token', 'secret'), ('timezone', 'UTC')`).run()
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body.timezone).toBe('UTC')
    expect(res.body.whatsapp_access_token).toBe('***')
  })
})

describe('PUT /api/config', () => {
  it('upserts config keys', async () => {
    const res = await request(app).put('/api/config').send({
      whatsapp_phone_number_id: 'ph123',
      timezone: 'America/New_York',
    })
    expect(res.status).toBe(200)
    const row = db.prepare(`SELECT value FROM config WHERE key = 'whatsapp_phone_number_id'`).get() as { value: string }
    expect(row.value).toBe('ph123')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npm test -- config
```

Expected: FAIL — `Cannot find module '../routes/config.js'`

- [ ] **Step 3: Implement `server/src/routes/config.ts`**

```typescript
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
```

- [ ] **Step 4: Implement `server/src/routes/upload.ts`**

```typescript
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
```

- [ ] **Step 5: Run config tests to verify they pass**

```bash
cd server && npm test -- config
```

Expected: all config tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/config.ts server/src/routes/upload.ts server/src/tests/config.test.ts
git commit -m "feat: config and upload routes"
```

---

## Task 8: Express App Entry Point

**Files:**
- Create: `server/src/index.ts`
- Create: `server/data/.gitkeep`

- [ ] **Step 1: Create `server/data/.gitkeep`**

```bash
mkdir -p server/data && touch server/data/.gitkeep
```

- [ ] **Step 2: Implement `server/src/index.ts`**

```typescript
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
```

- [ ] **Step 3: Verify server starts without errors**

```bash
cd server && npx tsx src/index.ts
```

Expected: `Server running on http://localhost:3001` with no errors. Stop with Ctrl+C.

- [ ] **Step 4: Run all server tests**

```bash
cd server && npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts server/data/.gitkeep
git commit -m "feat: Express app entry point with scheduler startup"
```

---

## Task 9: React App Shell + Routing

**Files:**
- Create: `client/src/main.tsx`
- Create: `client/src/types.ts`
- Create: `client/src/api.ts`
- Create: `client/src/App.tsx`
- Create: `client/src/components/Sidebar.tsx`
- Create: `client/src/components/StatusBadge.tsx`
- Create: `client/src/pages/QueuePage.tsx` (stub)
- Create: `client/src/pages/ComposePage.tsx` (stub)
- Create: `client/src/pages/ContactsPage.tsx` (stub)
- Create: `client/src/pages/SettingsPage.tsx` (stub)

- [ ] **Step 1: Create `client/src/types.ts`**

```typescript
export interface ScheduledMessage {
  id: string
  recipient_id: string
  recipient_name: string
  wa_id: string
  content_type: 'text' | 'image' | 'video' | 'document'
  text: string | null
  media_id: string | null
  scheduled_at: number
  status: 'pending' | 'sent' | 'failed'
  error: string | null
  created_at: number
}

export interface Contact {
  id: string
  name: string
  wa_id: string
  type: 'individual' | 'group'
  is_favorite: 0 | 1
}

export interface ConfigMap {
  whatsapp_phone_number_id?: string
  whatsapp_access_token?: string
  timezone?: string
}
```

- [ ] **Step 2: Create `client/src/api.ts`**

```typescript
import type { ScheduledMessage, Contact, ConfigMap } from './types'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  messages: {
    list: () => req<ScheduledMessage[]>('/api/messages'),
    create: (body: { recipient_id: string; content_type: string; text?: string; media_id?: string; scheduled_at: number }) =>
      req<ScheduledMessage>('/api/messages', { method: 'POST', body: JSON.stringify(body) }),
    remove: (id: string) => req<void>(`/api/messages/${id}`, { method: 'DELETE' }),
    retry: (id: string, scheduled_at: number) =>
      req<ScheduledMessage>(`/api/messages/${id}/retry`, { method: 'POST', body: JSON.stringify({ scheduled_at }) }),
  },
  contacts: {
    list: () => req<Contact[]>('/api/contacts'),
    create: (body: { name: string; wa_id: string; type: string }) =>
      req<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; is_favorite?: number }) =>
      req<Contact>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id: string) => req<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
    verify: () => req<{ ok: boolean; error?: string }>('/api/contacts/verify', { method: 'POST' }),
  },
  config: {
    get: () => req<ConfigMap>('/api/config'),
    save: (body: ConfigMap) => req<{ ok: boolean }>('/api/config', { method: 'PUT', body: JSON.stringify(body) }),
  },
  upload: {
    file: async (file: File): Promise<{ media_id: string }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      return res.json()
    },
  },
}
```

- [ ] **Step 3: Create `client/src/components/StatusBadge.tsx`**

```tsx
interface Props {
  status: 'pending' | 'sent' | 'failed'
}

const styles: Record<Props['status'], string> = {
  pending: 'background:#1d4ed8;color:#bfdbfe',
  sent:    'background:#166534;color:#bbf7d0',
  failed:  'background:#991b1b;color:#fecaca',
}

export function StatusBadge({ status }: Props) {
  return (
    <span style={{
      ...Object.fromEntries(styles[status].split(';').map(s => s.split(':'))),
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  )
}
```

- [ ] **Step 4: Create `client/src/components/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: '📋 Queue' },
  { to: '/compose', label: '✏️ Compose' },
  { to: '/contacts', label: '👥 Contacts' },
  { to: '/settings', label: '⚙️ Settings' },
]

export function Sidebar() {
  return (
    <nav style={{
      width: 200, minWidth: 200, background: '#111827', height: '100vh',
      display: 'flex', flexDirection: 'column', padding: '20px 0', boxSizing: 'border-box',
    }}>
      <div style={{ padding: '0 16px 24px', fontWeight: 700, fontSize: 16, color: '#6366f1' }}>
        WA Scheduler
      </div>
      {links.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
          padding: '10px 16px', textDecoration: 'none', color: isActive ? '#fff' : '#9ca3af',
          background: isActive ? '#1f2937' : 'transparent', display: 'block',
          borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
        })}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 5: Create stub pages**

Create `client/src/pages/QueuePage.tsx`:
```tsx
export function QueuePage() { return <div><h2>Queue</h2><p>Loading...</p></div> }
```

Create `client/src/pages/ComposePage.tsx`:
```tsx
export function ComposePage() { return <div><h2>Compose</h2></div> }
```

Create `client/src/pages/ContactsPage.tsx`:
```tsx
export function ContactsPage() { return <div><h2>Contacts</h2></div> }
```

Create `client/src/pages/SettingsPage.tsx`:
```tsx
export function SettingsPage() { return <div><h2>Settings</h2></div> }
```

- [ ] **Step 6: Create `client/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { QueuePage } from './pages/QueuePage'
import { ComposePage } from './pages/ComposePage'
import { ContactsPage } from './pages/ContactsPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#1f2937', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<QueuePage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: Create `client/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 8: Start dev server and verify the shell loads**

In one terminal: `cd server && npx tsx src/index.ts`  
In another: `cd client && npm run dev`

Open http://localhost:5173 — sidebar should show with 4 nav links, clicking between them works.

- [ ] **Step 9: Commit**

```bash
git add client/src/
git commit -m "feat: React app shell with sidebar navigation"
```

---

## Task 10: Queue Page

**Files:**
- Modify: `client/src/pages/QueuePage.tsx`

- [ ] **Step 1: Implement `client/src/pages/QueuePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { ScheduledMessage } from '../types'
import { StatusBadge } from '../components/StatusBadge'

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export function QueuePage() {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [retryId, setRetryId] = useState<string | null>(null)
  const [retryTime, setRetryTime] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setMessages(await api.messages.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Cancel this scheduled message?')) return
    await api.messages.remove(id)
    setMessages(m => m.filter(x => x.id !== id))
  }

  async function handleRetry() {
    if (!retryId || !retryTime) return
    const ts = Math.floor(new Date(retryTime).getTime() / 1000)
    try {
      const updated = await api.messages.retry(retryId, ts)
      setMessages(m => m.map(x => x.id === updated.id ? updated : x))
      setRetryId(null)
      setRetryTime('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Retry failed')
    }
  }

  if (loading) return <p style={{ color: '#9ca3af' }}>Loading...</p>
  if (error) return <p style={{ color: '#f87171' }}>{error}</p>

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Scheduled Queue</h2>

      {retryId && (
        <div style={{ background: '#374151', padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <p style={{ margin: '0 0 8px' }}>Pick a new send time:</p>
          <input
            type="datetime-local"
            value={retryTime}
            onChange={e => setRetryTime(e.target.value)}
            style={{ marginRight: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #4b5563', background: '#1f2937', color: '#f9fafb' }}
          />
          <button onClick={handleRetry} style={{ marginRight: 8, padding: '6px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Reschedule
          </button>
          <button onClick={() => setRetryId(null)} style={{ padding: '6px 12px', background: '#374151', color: '#9ca3af', border: '1px solid #4b5563', borderRadius: 6, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {messages.length === 0 && (
        <p style={{ color: '#9ca3af' }}>No messages scheduled. <a href="/compose" style={{ color: '#6366f1' }}>Compose one</a>.</p>
      )}

      {messages.map(msg => (
        <div key={msg.id} style={{ background: '#374151', borderRadius: 8, padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{msg.recipient_name}</div>
            <div style={{ color: '#d1d5db', fontSize: 14, marginBottom: 6 }}>
              {msg.content_type !== 'text' && <span style={{ marginRight: 6 }}>📎 [{msg.content_type}]</span>}
              {msg.text && <span>{msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text}</span>}
            </div>
            {msg.error && <div style={{ color: '#f87171', fontSize: 13 }}>{msg.error}</div>}
            <div style={{ color: '#9ca3af', fontSize: 13 }}>{formatTs(msg.scheduled_at)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <StatusBadge status={msg.status} />
            {msg.status === 'failed' && (
              <button onClick={() => { setRetryId(msg.id); setRetryTime('') }} style={{ padding: '4px 10px', fontSize: 12, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                Retry
              </button>
            )}
            {msg.status === 'pending' && (
              <button onClick={() => handleDelete(msg.id)} style={{ padding: '4px 10px', fontSize: 12, background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: 5, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

With both dev servers running, navigate to http://localhost:5173.  
The queue should show "No messages scheduled" with a Compose link. Status badges, cancel, and retry buttons should render correctly (test by inserting a row directly in SQLite if needed).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/QueuePage.tsx
git commit -m "feat: Queue page with status badges and retry dialog"
```

---

## Task 11: Compose Page

**Files:**
- Modify: `client/src/pages/ComposePage.tsx`

- [ ] **Step 1: Implement `client/src/pages/ComposePage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Contact } from '../types'

export function ComposePage() {
  const navigate = useNavigate()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [mediaId, setMediaId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.contacts.list().then(setContacts).catch(() => {})
  }, [])

  const filtered = contacts.filter(c =>
    contactSearch === '' ||
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.wa_id.includes(contactSearch)
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setUploading(true)
    setError(null)
    try {
      const { media_id } = await api.upload.file(f)
      setMediaId(media_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setFile(null)
      setMediaId(null)
    } finally {
      setUploading(false)
    }
  }

  function getContentType(): string {
    if (!file) return 'text'
    const mime = file.type
    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('video/')) return 'video'
    return 'document'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!recipientId) { setError('Select a recipient'); return }
    if (!text && !mediaId) { setError('Add a message or media'); return }
    if (!scheduledAt) { setError('Pick a send time'); return }
    const ts = Math.floor(new Date(scheduledAt).getTime() / 1000)
    setSubmitting(true)
    try {
      await api.messages.create({
        recipient_id: recipientId,
        content_type: getContentType(),
        text: text || undefined,
        media_id: mediaId || undefined,
        scheduled_at: ts,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #4b5563', background: '#111827',
    color: '#f9fafb', fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Compose Message</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>Recipient</label>
          <input
            placeholder="Search contacts…"
            value={contactSearch}
            onChange={e => setContactSearch(e.target.value)}
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <select
            value={recipientId}
            onChange={e => setRecipientId(e.target.value)}
            style={{ ...inputStyle, height: 120 }}
            size={5}
          >
            {filtered.length === 0 && <option disabled>No contacts found</option>}
            {filtered.map(c => (
              <option key={c.id} value={c.id}>
                {c.is_favorite ? '⭐ ' : ''}{c.name} ({c.wa_id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>Message</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="Type your message…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>
            Media (optional)
          </label>
          <input type="file" accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFileChange} />
          {uploading && <p style={{ color: '#9ca3af', fontSize: 13, margin: '6px 0 0' }}>Uploading…</p>}
          {file && mediaId && <p style={{ color: '#34d399', fontSize: 13, margin: '6px 0 0' }}>✓ {file.name} uploaded</p>}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>Send At</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && <p style={{ color: '#f87171', margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting || uploading}
          style={{
            padding: '10px 20px', background: submitting ? '#374151' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 15,
            cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}
        >
          {submitting ? 'Scheduling…' : 'Schedule Message'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to http://localhost:5173/compose. The recipient list, text area, file upload, and datetime picker should all render. Add a contact in SQLite or via the Contacts page, then compose a message scheduled 5 minutes in the future and submit — it should redirect to Queue showing the pending message.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ComposePage.tsx
git commit -m "feat: Compose page with recipient picker, media upload, scheduler"
```

---

## Task 12: Contacts Page

**Files:**
- Modify: `client/src/pages/ContactsPage.tsx`

- [ ] **Step 1: Implement `client/src/pages/ContactsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Contact } from '../types'

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [name, setName] = useState('')
  const [waId, setWaId] = useState('')
  const [type, setType] = useState<'individual' | 'group'>('individual')
  const [error, setError] = useState<string | null>(null)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  async function load() {
    setContacts(await api.contacts.list())
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.contacts.create({ name, wa_id: waId, type })
      setName(''); setWaId('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  async function toggleFavorite(c: Contact) {
    await api.contacts.update(c.id, { is_favorite: c.is_favorite ? 0 : 1 })
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this contact? Scheduled messages to them will also be removed.')) return
    await api.contacts.remove(id)
    await load()
  }

  async function handleVerify() {
    setVerifyResult(null)
    const res = await api.contacts.verify()
    setVerifyResult(res.ok ? '✓ Connected' : `✗ ${res.error ?? 'Failed'}`)
  }

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid #4b5563',
    background: '#111827', color: '#f9fafb', fontSize: 14,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Contacts</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {verifyResult && <span style={{ fontSize: 13, color: verifyResult.startsWith('✓') ? '#34d399' : '#f87171' }}>{verifyResult}</span>}
          <button onClick={handleVerify} style={{ padding: '6px 14px', background: '#374151', color: '#d1d5db', border: '1px solid #4b5563', borderRadius: 6, cursor: 'pointer' }}>
            Verify API
          </button>
        </div>
      </div>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
        <input placeholder="Phone / Group ID" value={waId} onChange={e => setWaId(e.target.value)} required style={inputStyle} />
        <select value={type} onChange={e => setType(e.target.value as 'individual' | 'group')} style={inputStyle}>
          <option value="individual">Individual</option>
          <option value="group">Group</option>
        </select>
        <button type="submit" style={{ padding: '7px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Add
        </button>
        {error && <p style={{ color: '#f87171', margin: 0, width: '100%' }}>{error}</p>}
      </form>

      {contacts.length === 0 && <p style={{ color: '#9ca3af' }}>No contacts yet. Add one above.</p>}

      {contacts.map(c => (
        <div key={c.id} style={{ background: '#374151', borderRadius: 8, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 13 }}>{c.wa_id}</span>
            <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 12, textTransform: 'uppercase' }}>{c.type}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggleFavorite(c)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #4b5563', borderRadius: 5, cursor: 'pointer', fontSize: 16 }}>
              {c.is_favorite ? '⭐' : '☆'}
            </button>
            <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 10px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: 5, cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to http://localhost:5173/contacts. Add a contact, star it, verify it appears first in the list. "Verify API" button should show connected/failed based on Settings config.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ContactsPage.tsx
git commit -m "feat: Contacts page with add, favorite, delete, API verify"
```

---

## Task 13: Settings Page

**Files:**
- Modify: `client/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Implement `client/src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { api } from '../api'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Jerusalem', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
  'Asia/Tokyo', 'Australia/Sydney',
]

export function SettingsPage() {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.config.get().then(cfg => {
      if (cfg.whatsapp_phone_number_id) setPhoneNumberId(cfg.whatsapp_phone_number_id)
      if (cfg.timezone) setTimezone(cfg.timezone)
    }).catch(() => {})
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSaved(false)
    try {
      await api.config.save({
        whatsapp_phone_number_id: phoneNumberId,
        ...(accessToken ? { whatsapp_access_token: accessToken } : {}),
        timezone,
      })
      setSaved(true)
      setAccessToken('')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #4b5563', background: '#111827',
    color: '#f9fafb', fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>
            WhatsApp Phone Number ID
          </label>
          <input
            value={phoneNumberId}
            onChange={e => setPhoneNumberId(e.target.value)}
            placeholder="e.g. 123456789012345"
            style={inputStyle}
          />
          <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>
            Found in Meta Business Manager → WhatsApp → Phone Numbers
          </p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>
            Access Token
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder="Leave blank to keep existing token"
            style={inputStyle}
          />
          <p style={{ color: '#6b7280', fontSize: 12, margin: '4px 0 0' }}>
            Permanent token from Meta Business Manager → System Users
          </p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#d1d5db', fontSize: 14 }}>Timezone</label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={inputStyle}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>

        {error && <p style={{ color: '#f87171', margin: 0 }}>{error}</p>}
        {saved && <p style={{ color: '#34d399', margin: 0 }}>✓ Settings saved</p>}

        <button type="submit" style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer', fontWeight: 600 }}>
          Save Settings
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to http://localhost:5173/settings. Fill in Phone Number ID, access token, and timezone. Save — the "✓ Settings saved" confirmation should appear and the token field should clear (while phone number ID persists). Re-opening Settings should show saved phone number ID.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/SettingsPage.tsx
git commit -m "feat: Settings page for WhatsApp credentials and timezone"
```

---

## Task 14: Docker

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
client/node_modules
server/node_modules
server/data
server/public
dist
.git
.superpowers
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install root dependencies (concurrently etc.)
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

# Build client
COPY client/ ./client/
RUN npm run build --workspace=client

# Build server
COPY server/ ./server/
RUN npm run build --workspace=server

# Production image
FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/public ./server/public
COPY --from=base /app/server/package.json ./server/
RUN cd server && npm install --production
RUN mkdir -p data

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/dist/index.js"]
```

- [ ] **Step 3: Update `server/src/index.ts` for production port**

The server already reads `process.env.PORT` — no change needed. In production the Docker `ENV PORT=3000` takes effect.

- [ ] **Step 4: Build the Docker image**

```bash
docker build -t whatsapp-scheduler .
```

Expected: build succeeds, `whatsapp-scheduler` image created

- [ ] **Step 5: Run and verify**

```bash
docker run -p 3000:3000 -v $(pwd)/data:/app/data whatsapp-scheduler
```

Open http://localhost:3000 — the full app should load, served by Express from the built React files. All 4 pages should be navigable.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: Docker image for single-command self-hosting"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Queue: list messages sorted by send time | Task 5 (GET /api/messages), Task 10 |
| Queue: status badges pending/sent/failed | Task 10 (StatusBadge) |
| Queue: cancel pending | Task 5 (DELETE), Task 10 |
| Queue: retry failed with new time | Task 5 (POST retry), Task 10 |
| Compose: recipient picker favorites + search | Task 11 |
| Compose: text message | Task 5, Task 11 |
| Compose: media upload → media ID | Task 7 (upload), Task 11 |
| Compose: date/time picker | Task 11 |
| Contacts: manually managed list | Task 6, Task 12 |
| Contacts: star/unstar | Task 6, Task 12 |
| Contacts: verify API connectivity | Task 6, Task 12 |
| Settings: phone number ID + access token | Task 7 (config), Task 13 |
| Settings: timezone | Task 7 (config), Task 13 |
| Scheduler: hydrate on startup | Task 4 |
| Scheduler: missed → failed | Task 4 |
| Scheduler: fire at scheduled time | Task 4, Task 5 |
| WhatsApp: send text | Task 3 |
| WhatsApp: send media with media ID | Task 3 |
| WhatsApp: upload media | Task 3, Task 7 |
| WhatsApp: 401 → failed + warning | Task 3, Task 6 |
| Docker: single image | Task 14 |
| SQLite schema | Task 2 |
| Sidebar navigation | Task 9 |
