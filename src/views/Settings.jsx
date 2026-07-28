import { useState } from 'react'
import { getSyncToken, setSyncToken, syncNow, useSyncStatus } from '../lib/sync'

export default function Settings() {
  const [token, setToken] = useState(getSyncToken() || '')
  const status = useSyncStatus()

  const save = () => {
    setSyncToken(token.trim())
    syncNow()
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Sync</h1></div>
      <p>Paste your private sync token to link this device.</p>
      <div className="settings-field">
        <label htmlFor="sync-token">Sync token</label>
        <input
          id="sync-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="sync token"
        />
      </div>
      <button className="btn-primary" onClick={save}>Save & sync</button>
      {status.error && <p className="status-error">{status.error}</p>}
      {status.lastSyncedAt && !status.error && (
        <p className="status-ok">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString()}</p>
      )}
    </div>
  )
}
