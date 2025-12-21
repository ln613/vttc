import { MongoClient } from 'mongodb'

let cachedDb = null
let cachedClient = null

export const connectDB = async () => {
  if (cachedDb) return cachedDb

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI environment variable is not set')

  const client = new MongoClient(uri)
  await client.connect()

  const env = process.env.NETLIFY_DEV ? 'dev' : (process.env.CONTEXT === 'production' ? '' : 'qa')
  const dbName = env ? `vttc-${env}` : 'vttc'

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

  let cursor = collection.find(filter, { projection })

  if (Object.keys(sort).length > 0) {
    cursor = cursor.sort(sort)
  }

  if (options.skip) {
    cursor = cursor.skip(options.skip)
  }

  if (options.limit) {
    cursor = cursor.limit(options.limit)
  }

  return cursor.toArray()
}

export const getOne = async (collectionName, filter = {}, projection = {}) => {
  validateParams({ collectionName })

  const db = getDB()
  return db.collection(collectionName).findOne(filter, { projection })
}

export const getById = async (collectionName, id, projection = {}) => {
  validateParams({ collectionName, id })

  return getOne(collectionName, { id }, projection)
}

export const save = async (collectionName, document) => {
  validateParams({ collectionName, document })

  const db = getDB()
  const collection = db.collection(collectionName)

  if (document.id) {
    const result = await collection.updateOne(
      { id: document.id },
      { $set: document },
      { upsert: true },
    )
    return result
  } else {
    const result = await collection.insertOne(document)
    return result
  }
}

export const remove = async (collectionName, filter) => {
  validateParams({ collectionName, filter })

  const db = getDB()
  return db.collection(collectionName).deleteOne(filter)
}

export const removeById = async (collectionName, id) => {
  validateParams({ collectionName, id })

  return remove(collectionName, { id })
}

const validateParams = (params) => {
  const errors = []

  if (params.collectionName !== undefined && !params.collectionName) {
    errors.push('collectionName is required')
  }

  if (params.id !== undefined && !params.id) {
    errors.push('id is required')
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
