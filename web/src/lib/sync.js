import { countImage } from './api'
import { queueAll, queueRemove } from './queue'

/** Send queued photos to the counting service and attach the result to their samples as an AI check. */
export async function flushQueue(store) {
  const items = await queueAll()
  let done = 0
  for (const { id, blob } of items) {
    try {
      const data = await countImage(new File([blob], 'queued.jpg', { type: blob.type || 'image/jpeg' }))
      store.patchItem('samples', id, { predicted: data.count, aiPending: false, engine: data.engine })
      await queueRemove(id)
      done++
    } catch { break } // still offline or service down: try again later
  }
  return done
}
