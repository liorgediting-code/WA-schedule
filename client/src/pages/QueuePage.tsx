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
