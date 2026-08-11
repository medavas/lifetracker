import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import AppShell from './components/AppShell'
import BottomNav from './components/BottomNav'
import QuickAdd from './components/QuickAdd'
import Dashboard from './views/Dashboard'
import AreasGrid from './views/AreasGrid'
import AreaView from './views/AreaView'
import Projects from './views/Projects'
import Journal from './views/Journal'
import YearList from './views/journal/YearList'
import MonthList from './views/journal/MonthList'
import DayList from './views/journal/DayList'
import DayDetail from './views/journal/DayDetail'
import Habits from './views/Habits'
import Nudges from './views/Nudges'
import Focus from './views/Focus'
import FinanceDashboard from './views/FinanceDashboard'
import Fitness from './views/Fitness'
import Settings from './views/Settings'
import { startSync } from './lib/sync'
import { startNudges } from './lib/nudgeRunner'
import './App.css'

/**
 * HashRouter on purpose: works identically as a static file, a PWA on the
 * phone home screen, and behind any host without server rewrite rules.
 * Swap to BrowserRouter when the rdeyo deploy has a real server.
 */
export default function App() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => startSync(), [])
  useEffect(() => startNudges(), [])

  return (
    <HashRouter>
      <AppShell onAdd={() => setQuickAddOpen(true)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/areas" element={<AreasGrid />} />
          <Route path="/area/projects" element={<Navigate to="/projects" replace />} />
          <Route path="/area/fitness" element={<Navigate to="/fitness" replace />} />
          <Route path="/area/:areaId" element={<AreaView />} />
          <Route path="/finance" element={<FinanceDashboard />} />
          <Route path="/fitness" element={<Fitness />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<Projects />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/journal/years" element={<YearList />} />
          <Route path="/journal/years/:year" element={<MonthList />} />
          <Route path="/journal/years/:year/:month" element={<DayList />} />
          <Route path="/journal/years/:year/:month/:day" element={<DayDetail />} />
          <Route path="/nudges" element={<Nudges />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppShell>
      <BottomNav onAdd={() => setQuickAddOpen(true)} />
      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}
    </HashRouter>
  )
}
