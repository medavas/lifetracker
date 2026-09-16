import { merge } from '../../src/lib/merge.js'

// In-memory EntityStore — the interface the Mongo store implements.
export function MemoryStore() {
  let entities = []
  return {
    async all() {
      return entities
    },
    async merge(incoming) {
      entities = merge(entities, incoming)
      return entities
    },
  }
}

// In-memory PushSubStore — the interface pushStore.js's Mongo version implements.
export function MemoryPushStore() {
  const byEndpoint = new Map()
  return {
    async all() {
      return [...byEndpoint.values()]
    },
    async save(sub) {
      byEndpoint.set(sub.endpoint, sub)
    },
    async remove(endpoint) {
      byEndpoint.delete(endpoint)
    },
  }
}

// In-memory PushStateStore — the interface pushStore.js's Mongo version implements.
export function MemoryPushStateStore() {
  let lastFired = {}
  return {
    async read() {
      return lastFired
    },
    async write(next) {
      lastFired = next
    },
  }
}
