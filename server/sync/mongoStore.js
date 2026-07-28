import mongoose from 'mongoose'
import { merge } from '../../src/lib/merge.js'

const schema = new mongoose.Schema(
  {
    kind: { type: String, required: true },
    id: { type: String, required: true },
    updatedAt: { type: Number, required: true },
    deletedAt: { type: Number, default: null },
    data: { type: Object, required: true },
  },
  { versionKey: false },
)
schema.index({ kind: 1, id: 1 }, { unique: true })

export function mongoStore(mongooseInstance = mongoose) {
  const Entity = mongooseInstance.models.Entity || mongooseInstance.model('Entity', schema)

  const toPlain = (doc) => ({ kind: doc.kind, id: doc.id, updatedAt: doc.updatedAt, deletedAt: doc.deletedAt ?? null, data: doc.data })

  return {
    async all() {
      return (await Entity.find({}).lean()).map(toPlain)
    },
    async merge(incoming) {
      const current = await this.all()
      const merged = merge(current, incoming)
      // Upsert winners (cheap at personal scale — full set each sync).
      await Promise.all(
        merged.map((e) =>
          Entity.updateOne({ kind: e.kind, id: e.id }, { $set: { updatedAt: e.updatedAt, deletedAt: e.deletedAt ?? null, data: e.data } }, { upsert: true }),
        ),
      )
      return merged
    },
  }
}
