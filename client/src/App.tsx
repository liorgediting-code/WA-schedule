import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { QueuePage } from './pages/QueuePage'
import { ComposePage } from './pages/ComposePage'
import { ContactsPage } from './pages/ContactsPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#1f2937', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<QueuePage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
