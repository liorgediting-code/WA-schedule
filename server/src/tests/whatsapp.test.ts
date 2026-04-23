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
