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
