import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from '@anthropic-ai/claude-agent-sdk'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const SYSTEM_PROMPT =
  "You are a supportive personal assistant embedded in the user's Stoa app. " +
  'Help them reflect on habits, journal entries, and goals. Keep replies concise and encouraging.'

async function runTurn(message, resumeSessionId) {
  const options = { model: 'claude-opus-4-8', systemPrompt: SYSTEM_PROMPT, allowedTools: [], maxTurns: 1, settingSources: [] }
  if (resumeSessionId) options.resume = resumeSessionId
  let sessionId = resumeSessionId || null
  let text = ''
  for await (const evt of query({ prompt: message, options })) {
    if (evt.type === 'system' && evt.session_id) sessionId = evt.session_id
    if (evt.type === 'result') {
      if (typeof evt.result === 'string') text = evt.result
      else if (Array.isArray(evt.content)) text = evt.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    }
  }
  return { text, sessionId }
}

app.post('/api/assist', async (req, res) => {
  try {
    const { message, sessionId } = req.body
    if (!message) return res.status(400).json({ error: 'Missing message' })
    const { text, sessionId: newId } = await runTurn(message, sessionId)
    res.json({ sessionId: newId, message: text || 'Unable to parse response' })
  } catch (err) {
    console.error('assist error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const distDir = path.join(__dirname, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (req, res, next) => (req.path.startsWith('/api/') ? next() : res.sendFile(path.join(distDir, 'index.html'))))
}

const PORT = process.env.PORT || 3001
// Loopback-only: this server is meant to be reached exclusively through the
// Tailscale tunnel described in BACKEND_SETUP.md, which forwards to
// 127.0.0.1 locally. Binding to all interfaces would expose the unauthenticated
// /api/assist route to the LAN or any misconfigured port-forward.
const HOST = process.env.HOST || '127.0.0.1'
app.listen(PORT, HOST, () => console.log(`Assistant server on ${HOST}:${PORT}`))
