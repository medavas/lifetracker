import { HashRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AppShell from './components/AppShell'
import BottomNav from './components/BottomNav'
import QuickAdd from './components/QuickAdd'
import Dashboard from './views/Dashboard'
import AreasGrid from './views/AreasGrid'
import AreaView from './views/AreaView'
import Journal from './views/Journal'
import Habits from './views/Habits'
import Settings from './views/Settings'
import { startSync } from './lib/sync'
import './App.css'

/**
 * HashRouter on purpose: works identically as a static file, a PWA on the
 * phone home screen, and behind any host without server rewrite rules.
 * Swap to BrowserRouter when the rdeyo deploy has a real server.
 */
export default function App() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => startSync(), [])

  return (
    <HashRouter>
      <AppShell onAdd={() => setQuickAddOpen(true)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/areas" element={<AreasGrid />} />
          <Route path="/area/:areaId" element={<AreaView />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
      <BottomNav onAdd={() => setQuickAddOpen(true)} />
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </HashRouter>
  )
}
