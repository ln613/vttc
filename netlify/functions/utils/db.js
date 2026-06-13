import { MongoClient, ObjectId } from 'mongodb'

let cachedDb = null
let cachedClient = null
let connectingPromise = null
let lastActivityAt = 0

// After this much idle time, verify the cached connection is still alive
// before reusing it — Atlas drops idle sockets, leaving a stale client
// that hangs on the next query.
const IDLE_RECHECK_MS = 5 * 60 * 1000
const PING_TIMEOUT_MS = 3000

// Ping the cached connection, bounded by a timeout so a dead socket can't
// hang the check itself. Returns true only if it responds in time.
const isConnectionHealthy = async () => {
  if (!cachedClient) return false
  try {
    await Promise.race([
      cachedClient.db('admin').command({ ping: 1 }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ping timeout')), PING_TIMEOUT_MS),
      ),
    ])
    return true
  } catch {
    return false
  }
}

// Drop the cached connection so the next connectDB() rebuilds it. Closing
// is fire-and-forget — a broken client shouldn't block the new connect.
const resetConnection = () => {
  const client = cachedClient
  cachedClient = null
  cachedDb = null
  connectingPromise = null
  if (client) Promise.resolve(client.close()).catch(() => {})
}

// Is this a connection/topology-level failure (vs. a normal app/validation
// error)? These are the cases where the cached client is the problem — a
// dead socket after a failover or host swap, a closed pool, a server that
// can't be selected — and reusing it would just hang the next request too.
const isConnectionError = (err) => {
  if (!err) return false
  const name = err.name || ''
  if (
    name === 'MongoNetworkError' ||
    name === 'MongoNetworkTimeoutError' ||
    name === 'MongoServerSelectionError' ||
    name === 'MongoNotConnectedError' ||
    name === 'MongoTopologyClosedError' ||
    name === 'MongoPoolClearedError'
  ) {
    return true
  }
  const msg = err.message || ''
  return /topology (was )?(closed|destroyed)|connection .*(closed|timed out)|socket|ECONNRESET|ETIMEDOUT|ENOTFOUND|EPIPE|server selection|pool (was )?cleared|not connected/i.test(
    msg,
  )
}

// Called from the API entry point when a handler throws. If the failure
// was connectivity (e.g. a mid-tournament failover left the cached client
// pointed at dead hosts), drop the connection so the NEXT request rebuilds
// against the current topology — self-healing without a manual restart.
// Returns whether a reset happened (so callers can log it if useful).
export const maybeResetOnError = (err) => {
  if (!isConnectionError(err)) return false
  resetConnection()
  return true
}

/**
 * Convert string _id to ObjectId for MongoDB queries
 */
export const toObjectId = (id) => {
  if (!id) return null
  if (id instanceof ObjectId) return id
  try {
    return new ObjectId(id)
  } catch {
    return id // Return as-is if not a valid ObjectId string
  }
}

/**
 * Convert ObjectId _id to string in document
 */
const convertIdToString = (doc) => {
  if (!doc) return doc
  if (doc._id instanceof ObjectId) {
    return { ...doc, _id: doc._id.toString() }
  }
  return doc
}

/**
 * Convert ObjectId _id to string in array of documents
 */
const convertIdsToString = (docs) => {
  if (!docs || !Array.isArray(docs)) return docs
  return docs.map(convertIdToString)
}

/**
 * Convert _id field in filter to ObjectId if it's a string
 */
const convertFilterIds = (filter) => {
  if (!filter) return filter
  const converted = { ...filter }
  if (converted._id && typeof converted._id === 'string') {
    converted._id = toObjectId(converted._id)
  }
  if (converted._id && converted._id.$in) {
    converted._id.$in = converted._id.$in.map(toObjectId)
  }
  return converted
}

export const connectDB = async () => {
  const now = Date.now()

  if (cachedDb) {
    // After a long idle gap the cached connection may be dead; verify it
    // with a bounded ping and rebuild if it's stale, instead of handing
    // back a client that will hang on the next query.
    if (now - lastActivityAt > IDLE_RECHECK_MS && !(await isConnectionHealthy())) {
      resetConnection()
    }
    if (cachedDb) {
      lastActivityAt = now
      return cachedDb
    }
  }

  // Concurrent callers (rapid-fire requests at cold start) must share a
  // single connection attempt — otherwise each creates its own
  // MongoClient and the pool leaks/exhausts, which manifests as requests
  // hanging.
  if (connectingPromise) return connectingPromise

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')

  connectingPromise = (async () => {
    const client = new MongoClient(uri, {
      // Fail fast instead of hanging when the cluster is unreachable.
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // Proactively retire idle sockets so the pool refreshes them rather
      // than handing out connections the server already dropped.
      maxIdleTimeMS: 60000,
      // Allow concurrency: `netlify dev` (and any single long-running
      // server) handles many client requests in ONE process sharing this
      // client — a pool of 1 would serialize them all behind one
      // connection. 50 gives headroom (M10 allows ~1500 connections).
      maxPoolSize: 50,
      // Keep a few connections warm so a request after an idle gap doesn't
      // pay a cold TLS reconnect (~2s) to Atlas. Without this, sporadic
      // traffic kept letting sockets idle out (maxIdleTimeMS) and every
      // first request reconnected — which is what made even a DB-free
      // tablet sign-in hang behind connectDB().
      minPoolSize: 5,
    })
    await client.connect()

    const dbName = 'vttc'
    cachedClient = client
    cachedDb = client.db(dbName)
    return cachedDb
  })()

  try {
    const db = await connectingPromise
    lastActivityAt = Date.now()
    return db
  } catch (err) {
    // Let the next request retry from scratch.
    connectingPromise = null
    throw err
  } finally {
    // Once resolved, future calls hit the cachedDb short-circuit; clear
    // the in-flight marker so a later reconnect can run if needed.
    if (cachedDb) connectingPromise = null
  }
}

export const getDB = () => {
  if (!cachedDb) throw new Error('Database not connected. Call connectDB first.')
  return cachedDb
}

export const get = async (collectionName, filter = {}, projection = {}, sort = {}, options = {}) => {
  validateParams({ collectionName })

  const db = getDB()
  const collection = db.collection(collectionName)
  const convertedFilter = convertFilterIds(filter)

  let cursor = collection.find(convertedFilter, { projection })

  if (Object.keys(sort).length > 0) {
    cursor = cursor.sort(sort)
  }

  if (options.skip) {
    cursor = cursor.skip(options.skip)
  }

  if (options.limit) {
    cursor = cursor.limit(options.limit)
  }

  const results = await cursor.toArray()
  return convertIdsToString(results)
}

export const getOne = async (collectionName, filter = {}, projection = {}) => {
  validateParams({ collectionName })

  const db = getDB()
  const convertedFilter = convertFilterIds(filter)
  const result = await db.collection(collectionName).findOne(convertedFilter, { projection })
  return convertIdToString(result)
}

export const getById = async (collectionName, _id, projection = {}) => {
  validateParams({ collectionName, _id })

  return getOne(collectionName, { _id }, projection)
}

export const save = async (collectionName, document) => {
  validateParams({ collectionName, document })

  const db = getDB()
  const collection = db.collection(collectionName)

  if (document._id) {
    const docToSave = { ...document, _id: toObjectId(document._id) }
    const result = await collection.updateOne(
      { _id: docToSave._id },
      { $set: docToSave },
      { upsert: true },
    )
    return result
  } else {
    const result = await collection.insertOne(document)
    return { ...result, insertedId: result.insertedId.toString() }
  }
}

export const remove = async (collectionName, filter) => {
  validateParams({ collectionName, filter })

  const db = getDB()
  const convertedFilter = convertFilterIds(filter)
  return db.collection(collectionName).deleteOne(convertedFilter)
}

export const removeById = async (collectionName, _id) => {
  validateParams({ collectionName, _id })

  return remove(collectionName, { _id })
}

export const unsetFields = async (collectionName, fields, filter = {}) => {
  validateParams({ collectionName })
  validateFields(fields)

  const db = getDB()
  const collection = db.collection(collectionName)
  const convertedFilter = convertFilterIds(filter)

  const unsetObj = fields.reduce((acc, field) => {
    acc[field] = ''
    return acc
  }, {})

  return collection.updateMany(convertedFilter, { $unset: unsetObj })
}

const validateParams = (params) => {
  const errors = []

  if (params.collectionName !== undefined && !params.collectionName) {
    errors.push('collectionName is required')
  }

  if (params._id !== undefined && !params._id) {
    errors.push('_id is required')
  }

  if (params.document !== undefined && !params.document) {
    errors.push('document is required')
  }

  if (params.filter !== undefined && !params.filter) {
    errors.push('filter is required')
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }
}

const validateFields = (fields) => {
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new Error('fields must be a non-empty array')
  }
}
