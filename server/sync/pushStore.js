import mongoose from 'mongoose'

const subSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { versionKey: false },
)

// One row, keyed by a fixed id -- the interval/daily nudge anchors the push
// runner needs, mirroring nudgeRunner's device-local lastFired map but with
// exactly one "device" (the server itself).
const stateSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    lastFired: { type: Object, default: {} },
  },
  { versionKey: false },
)

export function pushSubStore(mongooseInstance = mongoose) {
  const PushSub = mongooseInstance.models.PushSub || mongooseInstance.model('PushSub', subSchema)
  return {
    async all() {
      return (await PushSub.find({}).lean()).map((d) => ({ endpoint: d.endpoint, keys: d.keys }))
    },
    async save(sub) {
      await PushSub.updateOne({ endpoint: sub.endpoint }, { $set: { keys: sub.keys } }, { upsert: true })
    },
    async remove(endpoint) {
      await PushSub.deleteOne({ endpoint })
    },
  }
}

export function pushStateStore(mongooseInstance = mongoose) {
  const PushState = mongooseInstance.models.PushState || mongooseInstance.model('PushState', stateSchema)
  return {
    async read() {
      const doc = await PushState.findById('singleton').lean()
      return doc?.lastFired ?? {}
    },
    async write(lastFired) {
      await PushState.updateOne({ _id: 'singleton' }, { $set: { lastFired } }, { upsert: true })
    },
  }
}
