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
