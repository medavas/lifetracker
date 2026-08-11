import { useState } from 'react'
import { dailyActivity, dailyPresence, QUARTER_WEEKS } from '../lib/rewards'
import { readChartView, writeChartView } from '../lib/dashboardPrefs'
import DailyStack from './DailyStack'
import PracticeGrid from './PracticeGrid'

/**
 * The dashboard's one activity chart, tabbed between a week of magnitude
 * (DailyStack) and a quarter of presence (PracticeGrid) instead of showing
 * both stacked — "this week" and "last 7 days" were the same range twice.
 * The chosen tab is a device-local UI preference (dashboardPrefs.js), not
 * domain data, so it's read once at mount and written on every change.
 */
export default function ActivityChart({ logs, notes }) {
  const [view, setView] = useState(readChartView)

  const setAndSave = (next) => {
    setView(next)
    writeChartView(next)
  }

  return (
    <div className="card">
      <div className="bucket-tabs">
        <button className={`bucket-tab ${view === 'week' ? 'on' : ''}`} onClick={() => setAndSave('week')}>
          This week
        </button>
        <button className={`bucket-tab ${view === 'quarter' ? 'on' : ''}`} onClick={() => setAndSave('quarter')}>
          {QUARTER_WEEKS} weeks
        </button>
      </div>
      <div className="activity-chart">
        {view === 'week' ? (
          <DailyStack data={dailyActivity(logs, notes, 7)} />
        ) : (
          <PracticeGrid weeks={dailyPresence(logs, notes, QUARTER_WEEKS)} />
        )}
      </div>
    </div>
  )
}
