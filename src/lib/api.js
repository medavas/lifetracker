// Where the backend lives:
//  - VITE_API_URL set        -> use it (override for any custom setup)
//  - dev (vite on :5173)     -> the local backend on :3001
//  - built app (served by    -> same origin, so relative URLs. Over Tailscale
//    the backend / Tailscale)    the phone hits the same https origin.
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

export async function askAssistant(message, { userId, conversationId }) {
  const response = await fetch(`${API_BASE}/api/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      userId,
      conversationId,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
