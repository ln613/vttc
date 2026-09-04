import { connectDB, maybeResetOnError } from './utils/db.js'
import { apiHandlers } from './utils/handlers.js'
import { readMetrics, resetMetrics, recordApiCall } from './utils/metrics.js'

// A Pusher broadcast makes every client refetch at once. Letting the CDN
// answer that burst collapses ~N simultaneous requests into ~1 origin
// invocation (and one DB query), which is the only layer that can see the
// whole herd — a serverless function can't, since each concurrent request
// gets its own instance.
//
// Only shared, non-user-specific GETs are cached. Anything account-scoped
// must never be, or one user's response could be served to another.
const CACHEABLE_GET_TYPES = new Set(['liveScore', 'events'])
// Deliberately short: a client that just made a change refetches immediately,
// so this bounds how stale its own view can look. No stale-while-revalidate —
// serving minutes-old scores would be worse than a brief origin hit.
const EDGE_CACHE_SECONDS = 2

const cacheControlFor = (method, type) =>
  method === 'get' && CACHEABLE_GET_TYPES.has(type)
    ? `public, max-age=0, s-maxage=${EDGE_CACHE_SECONDS}`
    : 'no-store'

export const handler = async (event) => {
  try {
    const method = event.httpMethod.toLowerCase()

    // Handle preflight OPTIONS request
    if (method === 'options') {
      return createResponse(200, {})
    }

    const params = event.queryStringParameters || {}
    const { type } = params

    if (!type) {
      return createResponse(400, { error: 'type parameter is required' })
    }

    // Dev-only load-test instrumentation. Deployed functions are per-instance
    // so these counters would be meaningless (and are not exposed) there.
    if (type === '__metrics') {
      if (process.env.NETLIFY_DEV !== 'true') {
        return createResponse(404, { error: 'not found' })
      }
      return createResponse(200, params.reset === '1' ? resetMetrics() : readMetrics())
    }

    recordApiCall(method, type)

    if (!apiHandlers[method] || !apiHandlers[method][type]) {
      return createResponse(404, { error: `Handler not found for ${method} ${type}` })
    }

    await connectDB()

    let body = null
    if (method === 'post' && event.body) {
      body = JSON.parse(event.body)
    }

    const result = await apiHandlers[method][type](method === 'post' ? body : params)
    return createResponse(200, result, cacheControlFor(method, type))
  } catch (error) {
    console.error('API Error:', error)
    // If this failed because the cached DB connection is dead (e.g. a
    // failover or host swap left it pointed at gone nodes), drop it so the
    // next request reconnects to the current topology instead of hanging.
    if (maybeResetOnError(error)) {
      console.error('DB connection reset after connectivity error')
    }
    return createResponse(500, { error: error.message })
  }
}

const createResponse = (statusCode, data, cacheControl = 'no-store') => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
  body: JSON.stringify(data),
})
