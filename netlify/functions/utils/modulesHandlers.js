// The club's module switches — see specs/rules/modules.md and
// shared/rules/modules.js. Stored beside the settings, but saved only by a
// super admin (accessPolicy.js), never through saveSettings.

import { getDB } from './db.js'
import { club } from './club.js'
import { normalizeModules, isModuleOn } from '../../../shared/rules/modules.js'

const COLLECTION = 'settings'
const DOC_ID = 'modules'

const throwError = (message) => {
  throw new Error(message)
}

const readStoredModules = async () => {
  const doc = await getDB().collection(COLLECTION).findOne({ docId: DOC_ID })
  return doc?.modules || null
}

/** Every switch, with the locks applied. Public: the browser needs it. */
export const getModules = async () => normalizeModules(await readStoredModules(), club)

export const saveModules = async (body) => {
  if (!body || typeof body !== 'object') throwError('Modules are required')
  const modules = normalizeModules(body, club)
  await getDB()
    .collection(COLLECTION)
    .updateOne(
      { docId: DOC_ID },
      { $set: { docId: DOC_ID, modules, updatedAt: new Date().toISOString() } },
      { upsert: true },
    )
  return { modules }
}

/**
 * Refuses unless every named module is in effect. For endpoints whose
 * feature can be turned off — booking, credits, My Booking.
 */
export const requireModules = async (...keys) => {
  const modules = await getModules()
  if (keys.some((key) => !isModuleOn(modules, key))) {
    throwError('This feature is turned off at this club')
  }
}
