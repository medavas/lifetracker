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
    <main className="view settings">
      <h1>Sync</h1>
      <p>Paste your private sync token to link this device.</p>
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="sync token"
        aria-label="Sync token"
      />
      <button onClick={save}>Save & sync</button>
      {status.error && <p className="sync-error">{status.error}</p>}
      {status.lastSyncedAt && !status.error && (
        <p className="sync-ok">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString()}</p>
      )}
    </main>
  )
}
