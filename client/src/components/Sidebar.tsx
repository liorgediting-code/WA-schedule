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
