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
