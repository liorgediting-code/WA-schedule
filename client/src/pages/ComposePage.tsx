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
