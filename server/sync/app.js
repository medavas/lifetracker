import express from 'express'
import cors from 'cors'
import { timingSafeEqual, createHash } from 'crypto'
import { KINDS } from '../../src/lib/merge.js'

// Fixed-length digest comparison so a mismatched token takes the same time
// regardless of where the first differing byte is (plain !== leaks that via
// timing, since it short-circuits at the first mismatch).
function tokensMatch(provided, expected) {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

export function createApp({ store, token }) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '5mb' }))

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use((req, res, next) => {
    const header = req.get('authorization') || ''
    const provided = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!provided || !tokensMatch(provided, token)) return res.status(401).json({ error: 'bad token' })
    next()
  })

  app.post('/sync', async (req, res) => {
    const incoming = Array.isArray(req.body?.entities) ? req.body.entities : []
    // kind/id gate a Mongo filter downstream (mongoStore.merge) — restrict
    // both to plain expected values so a crafted body can't smuggle a query
    // operator (e.g. { "$ne": null }) into that filter.
    const entities = incoming.filter((e) => e && KINDS.includes(e.kind) && typeof e.id === 'string')
    const merged = await store.merge(entities)
    res.json({ entities: merged, serverTime: Date.now() })
  })

  return app
}
