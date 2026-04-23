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
