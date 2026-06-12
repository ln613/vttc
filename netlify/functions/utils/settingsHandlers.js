import { getDB } from './db.js'

const COLLECTION = 'settings'
const DOC_ID = 'global'

const DEFAULT_SETTINGS = {
  // When true, unpaid participants are excluded from generating
  // groups / round-robin / first-round knockout (when no group stage
  // exists). When false, they are included.
  ignoreUnpaidInGeneration: true,
}

const throwError = (msg) => {
  throw new Error(msg)
}

const readSettingsDoc = async () => {
  const db = getDB()
  const doc = await db.collection(COLLECTION).findOne({ docId: DOC_ID })
  return { ...DEFAULT_SETTINGS, ...(doc?.settings || {}) }
}

export const getSettings = async () => readSettingsDoc()

export const saveSettings = async (body) => {
  if (!body) throwError('Request body is required')
  const allowedKeys = Object.keys(DEFAULT_SETTINGS)
  const settings = {}
  for (const k of allowedKeys) {
    if (k in body) settings[k] = body[k]
  }
  const db = getDB()
  await db.collection(COLLECTION).updateOne(
    { docId: DOC_ID },
    {
      $set: {
        docId: DOC_ID,
        settings: { ...DEFAULT_SETTINGS, ...settings },
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
  return { success: true, settings: { ...DEFAULT_SETTINGS, ...settings } }
}
