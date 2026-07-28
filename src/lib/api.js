const ASSIST_BASE =
  import.meta.env.VITE_ASSIST_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '')

export async function askAssistant(message, { sessionId } = {}) {
  const res = await fetch(`${ASSIST_BASE}/api/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
  if (!res.ok) throw new Error(`Assistant error: ${res.status}`)
  return res.json() // { sessionId, message }
}
