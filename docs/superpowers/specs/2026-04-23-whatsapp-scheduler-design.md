# WhatsApp Scheduler — Design Spec

**Date:** 2026-04-23  
**Status:** Approved

---

## Overview

A self-hosted web app for scheduling WhatsApp messages (text + media) to individual contacts and groups via the WhatsApp Business Cloud API. Designed for personal use first, with a clean path to multi-user later.

---

## Architecture

**Stack:** React (Vite) frontend + Express backend + SQLite + Docker

The Express server serves three responsibilities in one process:
1. REST API consumed by the React SPA
2. In-process job scheduler (`node-schedule`)
3. Static file server for the compiled React build

This means there is one deployable unit: a single Docker image. Running locally: `npm run dev`. Self-hosting: `docker run -p 3000:3000 whatsapp-scheduler`.

**Scaling path to multi-user:** add session-based auth middleware to Express, swap SQLite for Postgres (schema stays the same), add a `users` table and tenant scoping to all queries.

---

## Components

### Frontend (React + Vite)

Single-page app with a persistent left sidebar and four screens:

- **Queue** — all scheduled messages sorted by send time; status badges (pending / sent / failed); cancel or edit each item; retry button on failed messages
- **Compose** — recipient picker (favorites list + live search against WhatsApp API), message text area, optional media upload, date/time picker, schedule button
- **Contacts** — manually managed list (name + WhatsApp phone number or group ID); sync button verifies API connectivity; star/unstar to mark favorites
- **Settings** — WhatsApp Business API credentials (phone number ID, access token), timezone

### Backend (Express)

REST API routes:
- `GET/POST/DELETE /api/messages` — queue CRUD
- `POST /api/messages/:id/retry` — reschedule a failed message
- `GET/POST/PUT /api/contacts` — contacts CRUD + favorite toggle
- `POST /api/contacts/verify` — ping WhatsApp API to verify credentials and connectivity
- `GET/PUT /api/config` — read/write credentials and timezone

### Scheduler (`node-schedule`)

- On server startup: reads all `status = 'pending'` messages from SQLite and registers a job for each
- At send time: calls WhatsApp API, updates status to `sent` or `failed`
- Missed messages (scheduled while app was offline, `scheduled_at` in the past): marked `failed` with reason `"missed — app was offline"` on startup
- No automatic retries — retries are manual via the Queue UI

### WhatsApp API Client

Wraps Meta's Graph API (WhatsApp Business Cloud):
- Send text message to a phone number or group ID
- Upload media → get media ID → store with message
- Verify credentials (ping API, confirm phone number ID is valid)
- On 401 response: mark message `failed`, surface a warning banner in Settings

**Note:** The WhatsApp Business Cloud API does not provide a contact or group browser endpoint. Contacts are managed manually in the app (user enters name + WhatsApp phone number or group ID). Group IDs can be found in the WhatsApp Business Manager or by inspecting incoming webhook payloads.

### Media Handling

1. User uploads file in Compose UI
2. Server forwards file to WhatsApp Media API immediately
3. WhatsApp media ID is stored on the `scheduled_messages` record
4. Local file is deleted after successful upload
5. At send time, the media ID is used directly in the API call

---

## Data Model (SQLite)

### `scheduled_messages`

| column | type | notes |
|---|---|---|
| id | TEXT | UUID, primary key |
| recipient_id | TEXT | FK → contacts.id |
| content_type | TEXT | `text`, `image`, `video`, `document` |
| text | TEXT | nullable (media-only messages) |
| media_id | TEXT | WhatsApp media ID after upload (expires ~30 days) |
| scheduled_at | INTEGER | Unix timestamp (UTC) |
| status | TEXT | `pending`, `sent`, `failed` |
| error | TEXT | error detail if failed |
| created_at | INTEGER | Unix timestamp |

### `contacts`

| column | type | notes |
|---|---|---|
| id | TEXT | UUID, primary key |
| name | TEXT | display name |
| wa_id | TEXT | WhatsApp phone number or group ID |
| type | TEXT | `individual` or `group` |
| is_favorite | INTEGER | 0 or 1 |

### `config`

| column | type | notes |
|---|---|---|
| key | TEXT | primary key |
| value | TEXT | plain text value |

Config keys: `whatsapp_phone_number_id`, `whatsapp_access_token`, `timezone`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| WhatsApp API call fails | Status → `failed`, error message stored, red badge in Queue |
| 401 from WhatsApp API | Status → `failed`, warning banner shown in Settings |
| App offline when message was due | Status → `failed` with reason "missed — app was offline" on next startup |
| Media upload fails | Compose shows inline error, message not saved |
| Retry | Manual — user clicks Retry; a dialog opens to pick a new send time (defaults to now + 1 min); confirms and re-queues the message |
| Media ID expired (>30 days old) | Status → `failed` with reason "media expired"; user must re-upload and reschedule |

---

## Docker

Single `Dockerfile`:
1. Build React SPA (`vite build`)
2. Copy build output into Express `public/` directory
3. Expose port 3000
4. `CMD ["node", "server/index.js"]`

Local dev: `npm run dev` runs Vite dev server (port 5173) + Express (port 3000) concurrently with a proxy.

---

## Out of Scope (v1)

- Multi-user / authentication
- Recurring/repeating schedules
- WhatsApp message templates (interactive buttons, lists)
- Push notifications for send failures
- Message history beyond the queue
