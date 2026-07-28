import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { mongoStore } from '../mongoStore.js'

let mem
beforeAll(async () => {
  mem = await MongoMemoryServer.create()
  await mongoose.connect(mem.getUri())
}, 60000)
afterAll(async () => {
  await mongoose.disconnect()
  await mem.stop()
})

const ent = (over) => ({ kind: 'note', id: 'n1', updatedAt: 1, deletedAt: null, data: { id: 'n1', text: 'a' }, ...over })

describe('mongoStore', () => {
  it('persists and merges by updatedAt', async () => {
    const store = mongoStore(mongoose)
    await store.merge([ent()])
    const after = await store.merge([ent({ updatedAt: 9, data: { id: 'n1', text: 'b' } })])
    const n1 = after.find((e) => e.id === 'n1')
    expect(n1.data.text).toBe('b')
    expect((await store.all()).length).toBe(1)
  })
})
