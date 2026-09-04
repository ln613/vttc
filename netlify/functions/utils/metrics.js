// Lightweight in-memory counters used to measure load during local
// simulations. `netlify dev` runs every function in ONE process, so these
// accumulate across requests; deployed functions are per-instance, which is
// why the read endpoint is dev-only (see api.js).
const counters = {
  startedAt: new Date().toISOString(),
  apiCalls: 0,
  apiByType: {},
  pusherSent: 0,
  pusherSuppressed: 0,
  pusherByChannel: {},
  dbConnectsCreated: 0,
}

const bump = (bucket, key) => {
  counters[bucket][key] = (counters[bucket][key] || 0) + 1
}

export const recordApiCall = (method, type) => {
  counters.apiCalls++
  bump('apiByType', `${method}:${type}`)
}

export const recordPusherSent = (channel) => {
  counters.pusherSent++
  bump('pusherByChannel', channel)
}

export const recordPusherSuppressed = () => {
  counters.pusherSuppressed++
}

export const recordDbConnect = () => {
  counters.dbConnectsCreated++
}

export const readMetrics = () => ({
  ...counters,
  apiByType: { ...counters.apiByType },
  pusherByChannel: { ...counters.pusherByChannel },
  readAt: new Date().toISOString(),
})

export const resetMetrics = () => {
  counters.startedAt = new Date().toISOString()
  counters.apiCalls = 0
  counters.apiByType = {}
  counters.pusherSent = 0
  counters.pusherSuppressed = 0
  counters.pusherByChannel = {}
  counters.dbConnectsCreated = 0
  return readMetrics()
}
