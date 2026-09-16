import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { MemoryStore, MemoryPushStore } from '../store.js'

const TOKEN = 'secret'
const app = (subStore) => createApp({ store: MemoryStore(), token: TOKEN, subStore })
const ent = (over) => ({ kind: 'item', id: 'i1', updatedAt: 1, deletedAt: null, data: { id: 'i1' }, ...over })
const sub = (over) => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' }, ...over })

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
  it('drops entities with a non-string id or unknown kind instead of passing them to the store', async () => {
    const a = app()
    const res = await request(a).post('/sync').set('Authorization', `Bearer ${TOKEN}`)
      .send({ entities: [ent({ id: { $ne: null } }), ent({ kind: 'admin' }), ent({ id: 'ok' })] }).expect(200)
    expect(res.body.entities).toHaveLength(1)
    expect(res.body.entities[0].id).toBe('ok')
  })

  it('push routes need auth like /sync does', async () => {
    await request(app()).post('/push/subscribe').send({ subscription: sub() }).expect(401)
    await request(app()).post('/push/unsubscribe').send({ endpoint: sub().endpoint }).expect(401)
  })

  it('stores a subscription and removes it on unsubscribe', async () => {
    const subStore = MemoryPushStore()
    const a = app(subStore)
    await request(a).post('/push/subscribe').set('Authorization', `Bearer ${TOKEN}`)
      .send({ subscription: sub() }).expect(200, { ok: true })
    expect(await subStore.all()).toEqual([sub()])

    await request(a).post('/push/unsubscribe').set('Authorization', `Bearer ${TOKEN}`)
      .send({ endpoint: sub().endpoint }).expect(200, { ok: true })
    expect(await subStore.all()).toEqual([])
  })

  it('rejects a subscription missing endpoint or keys', async () => {
    const a = app()
    await request(a).post('/push/subscribe').set('Authorization', `Bearer ${TOKEN}`)
      .send({ subscription: { endpoint: 'https://push.example/abc' } }).expect(400)
    await request(a).post('/push/subscribe').set('Authorization', `Bearer ${TOKEN}`)
      .send({}).expect(400)
  })
})
