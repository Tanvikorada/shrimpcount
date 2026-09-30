// Free trial: someone without an owner-issued account can save DEMO_LIMIT counts, then is asked to contact us.
// Signed-in accounts (given out by the owner - see docs/cloud-setup.md) are never limited.
// Honest limit of this: it is enforced on the phone, from the phone's own saved records, not by a server. Clearing this
// phone's site data, or opening the app on another phone or browser, starts a fresh trial. It is a speed bump for casual
// reuse of a public link, not real access control. Real control would need the server to track usage - a bigger job.
export const DEMO_LIMIT = 2

export const isDemoAccount = (cloud) => !cloud?.user
export const demoUsesLeft = (store) => Math.max(0, DEMO_LIMIT - (store.samples?.length || 0))
export const demoLimitReached = (store, cloud) => isDemoAccount(cloud) && demoUsesLeft(store) <= 0

/** Send them to the count screen, or to the "contact us" screen if their free trial is used up. */
export function goCount(store, cloud, go, batchId) {
  go(demoLimitReached(store, cloud) ? '/access' : `/count/${batchId}`)
}
