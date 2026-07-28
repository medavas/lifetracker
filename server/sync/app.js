import express from 'express'
import cors from 'cors'

export function createApp({ store, token }) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use((req, res, next) => {
    const header = req.get('authorization') || ''
    const provided = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!provided || provided !== token) return res.status(401).json({ error: 'bad token' })
    next()
  })

  app.post('/sync', async (req, res) => {
    const incoming = Array.isArray(req.body?.entities) ? req.body.entities : []
    const entities = await store.merge(incoming)
    res.json({ entities, serverTime: Date.now() })
  })

  return app
}
