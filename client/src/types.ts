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
