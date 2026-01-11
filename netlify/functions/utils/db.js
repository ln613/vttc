import { MongoClient, ObjectId } from 'mongodb'

let cachedDb = null
let cachedClient = null

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
  if (cachedDb) return cachedDb

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')

  const client = new MongoClient(uri)
  await client.connect()

  const env = process.env.NETLIFY_DEV ? 'dev' : (process.env.CONTEXT === 'production' ? '' : 'qa')
  const dbName = 'vttc' // env ? `vttc-${env}` : 'vttc'

  cachedClient = client
  cachedDb = client.db(dbName)

  return cachedDb
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
