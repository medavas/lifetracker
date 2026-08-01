import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createApp } from './app.js'
import { mongoStore } from './mongoStore.js'

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '.env') })

const { MONGODB_URI, SYNC_TOKEN, PORT = 4000 } = process.env
if (!MONGODB_URI || !SYNC_TOKEN) {
  console.error('Sync API needs MONGODB_URI and SYNC_TOKEN')
  process.exit(1)
}

await mongoose.connect(MONGODB_URI)
const app = createApp({ store: mongoStore(mongoose), token: SYNC_TOKEN })
app.listen(PORT, () => console.log(`Sync API on :${PORT}`))
