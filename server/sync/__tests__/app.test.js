import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore } from '../store.js'

const TOKEN = 'secret'
const app = () => createApp({ store: MemoryStore(), token: TOKEN })
const ent = (over) => ({ kind: 'item', id: 'i1', updatedAt: 1, deletedAt: null, data: { id: 'i1' }, ...over })

describe('sync API', () => {
  it('health needs no auth', async () => {
    await request(app()).get('/health').expect(200, { ok: true })
  })
  it('rejects missing token', async () => {
    await request(app()).post('/sync').send({ entities: [] }).expect(401)
  })
  it('rejects wrong token', async () => {
    await request(app()).post('/sync').set('Authorization', 'Bearer nope').send({ entities: [] }).expect(401)
  })
  it('stores and returns merged entities', async () => {
    const a = app()
    await request(a).post('/sync').set('Authorization', `Bearer ${TOKEN}`).send({ entities: [ent()] }).expect(200)
    const res = await request(a).post('/sync').set('Authorization', `Bearer ${TOKEN}`)
      .send({ entities: [ent({ updatedAt: 5, data: { id: 'i1', v: 2 } })] }).expect(200)
    expect(res.body.entities).toHaveLength(1)
    expect(res.body.entities[0].data.v).toBe(2)
    expect(typeof res.body.serverTime).toBe('number')
  })
})
