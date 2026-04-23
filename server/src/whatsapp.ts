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
      form.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), filename)

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
