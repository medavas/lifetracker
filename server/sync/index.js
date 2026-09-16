import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createApp } from './app.js'
import { mongoStore } from './mongoStore.js'
import { pushSubStore, pushStateStore } from './pushStore.js'
import { createPusher } from './webPush.js'
import { createPushRunner } from './pushRunner.js'
import { fromEntities } from '../../src/lib/merge.js'
import { DEFAULT_QUIET } from '../../src/lib/timers.js'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') })

const {
  MONGODB_URI, SYNC_TOKEN, PORT = 4000,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT,
  QUIET_START_MIN, QUIET_END_MIN,
} = process.env
if (!MONGODB_URI || !SYNC_TOKEN) {
  console.error('Sync API needs MONGODB_URI and SYNC_TOKEN')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI)
const store = mongoStore(mongoose)
const subStore = pushSubStore(mongoose)
const app = createApp({ store, token: SYNC_TOKEN, subStore })
app.listen(PORT, () => console.log(`Sync API on :${PORT}`))

// Push is optional -- an existing deployment with no VAPID keys set just
// keeps working as a plain sync API, same as before this feature existed.
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
  const stateStore = pushStateStore(mongoose)
  const pushToAll = createPusher({ publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT, subStore })
  const quiet = {
    ...DEFAULT_QUIET,
    ...(QUIET_START_MIN != null && { startMin: Number(QUIET_START_MIN) }),
    ...(QUIET_END_MIN != null && { endMin: Number(QUIET_END_MIN) }),
  }
  const runner = createPushRunner({
    getNudges: async () => {
      const { items } = fromEntities(await store.all())
      return items.filter((i) => !i.deletedAt && i.areaId === 'nudges' && i.status !== 'archived')
    },
    getLastFired: () => stateStore.read(),
    setLastFired: (next) => stateStore.write(next),
    getQuiet: () => quiet,
    sendPush: pushToAll,
    now: Date.now,
  })
  setInterval(() => runner.tick().catch((err) => console.error('push tick failed', err)), 30_000)
  console.log('Push notifications enabled')
} else {
  console.log('Push notifications disabled (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT to enable)')
}
